"""Playwright browser worker.

One shared Playwright driver; every task gets an ISOLATED browser context
(own cookies/storage/cache, no host filesystem access, downloads blocked,
bounded execution, guaranteed cleanup). Websites are assumed hostile.
"""
import asyncio
import base64
import logging
import time
from typing import Dict, Optional

from app.browser.observation import SCROLL_JS, Observation, observe_page
from app.browser.tools import ToolResult
from app.browser.verification import (
    PageSignature,
    page_signature,
    verify_click,
    verify_navigation,
    verify_scroll,
)
from app.config import settings

log = logging.getLogger("nebula.browser")


class BrowserUnavailable(Exception):
    pass


class BrowserWorker:
    """Manages the shared Playwright driver and per-task sessions."""

    #: Final browser state per finished task (URL/title/last frame only, in
    #: memory, bounded) so the UI can still show what the agent last saw.
    FINAL_FRAME_CACHE = 12

    def __init__(self):
        self._pw = None
        self._browser = None
        self._lock = asyncio.Lock()
        self._sessions: Dict[str, "TaskSession"] = {}
        self._final_frames: Dict[str, dict] = {}

    async def _ensure_browser(self):
        async with self._lock:
            if self._browser and self._browser.is_connected():
                return self._browser
            try:
                if self._pw is None:
                    from playwright.async_api import async_playwright
                    self._pw = await async_playwright().start()
                self._browser = await self._pw.chromium.launch(
                    headless=settings.browser_headless,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--no-first-run",
                        "--disable-background-networking",
                    ],
                )
                log.info("Chromium browser started")
                return self._browser
            except Exception as e:
                self._pw = None
                raise BrowserUnavailable(f"Browser could not be started: {e}") from e

    async def start_task_session(self, task_id: str) -> "TaskSession":
        if task_id in self._sessions:
            return self._sessions[task_id]
        browser = await self._ensure_browser()
        context = await browser.new_context(
            viewport={"width": settings.browser_viewport_width, "height": settings.browser_viewport_height},
            accept_downloads=False,
            java_script_enabled=True,  # needed for the modern web; page JS is sandboxed by Chromium
            timezone_id="Asia/Kolkata",
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 NebulaAgent/1.0"),
        )
        context.set_default_timeout(15000)
        context.set_default_navigation_timeout(30000)
        page = await context.new_page()
        session = TaskSession(task_id=task_id, context=context, page=page)
        self._sessions[task_id] = session
        log.info("Isolated browser context started for task %s", task_id)
        return session

    def get_session(self, task_id: str) -> Optional["TaskSession"]:
        return self._sessions.get(task_id)

    async def close_task_session(self, task_id: str):
        session = self._sessions.pop(task_id, None)
        if session:
            # Remember the final observable state (no disk writes, bounded cache).
            try:
                self._final_frames[task_id] = {
                    "url": session.page.url,
                    "origin": session.current_origin,
                    "title": await session.page.title(),
                    "screenshot": session.last_screenshot_b64,
                    "updated_at": session.screenshot_updated_at or time.time(),
                }
                while len(self._final_frames) > self.FINAL_FRAME_CACHE:
                    self._final_frames.pop(next(iter(self._final_frames)))
            except Exception:
                pass
            try:
                await session.context.close()
            except Exception:
                pass
            log.info("Browser context closed for task %s", task_id)

    def get_final_frame(self, task_id: str):
        return self._final_frames.get(task_id)

    async def shutdown(self):
        for task_id in list(self._sessions):
            await self.close_task_session(task_id)
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        if self._pw:
            try:
                await self._pw.stop()
            except Exception:
                pass


class TaskSession:
    """Per-task isolated browser session exposing ONLY the audited tools."""

    def __init__(self, task_id: str, context, page):
        self.task_id = task_id
        self.context = context
        self.page = page
        self.current_origin: str = ""
        self.last_screenshot_b64: str = ""
        self.screenshot_updated_at: float = 0.0
        self.status: str = "idle"  # idle | loading | ready | error
        self._executed_guard = False

    # ------------------------------------------------------------------ tools
    async def navigate(self, url: str) -> ToolResult:
        t0 = time.monotonic()
        self.status = "loading"
        before_sig = await page_signature(self.page)
        try:
            resp = await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await self._settle()
            status = resp.status if resp else 0
            http_ok = status == 0 or status < 400
            after_sig = await page_signature(self.page)
            report = verify_navigation(before_sig, after_sig, url)
            ok = http_ok and report.verified
            self.current_origin = self._origin(self.page.url)
            self.status = "ready" if ok else "error"
            await self.capture_screenshot()
            return ToolResult(
                tool="navigate", ok=ok,
                summary=f"Opened {self._origin(self.page.url)} ({self.page.url})",
                data={"url": self.page.url, "http_status": status,
                      "verified": report.verified, "verification": report.detail},
                duration_ms=int((time.monotonic() - t0) * 1000),
                error=None if ok else f"HTTP {status}",
            )
        except Exception as e:
            self.status = "error"
            return ToolResult(tool="navigate", ok=False, summary="Navigation failed",
                              error=str(e)[:300], duration_ms=int((time.monotonic() - t0) * 1000))

    async def go_back(self) -> ToolResult:
        t0 = time.monotonic()
        try:
            await self.page.go_back(wait_until="domcontentloaded", timeout=15000)
            await self.capture_screenshot()
            return ToolResult(tool="go_back", ok=True, summary=f"Went back to {self.page.url}",
                              data={"url": self.page.url},
                              duration_ms=int((time.monotonic() - t0) * 1000))
        except Exception as e:
            return ToolResult(tool="go_back", ok=False, summary="Back navigation failed",
                              error=str(e)[:200])

    async def observe(self) -> Observation:
        return await observe_page(self.page)

    async def read_page(self) -> ToolResult:
        t0 = time.monotonic()
        obs = await self.observe()
        if obs.error:
            return ToolResult(tool="read_page", ok=False, summary="Could not read page", error=obs.error)
        await self.capture_screenshot()
        return ToolResult(
            tool="read_page", ok=True,
            summary=f"Read page \"{obs.title[:70]}\" ({len(obs.elements)} interactive elements)",
            data={"url": obs.url, "title": obs.title,
                  "text_chars": len(obs.text),
                  "elements": [e.describe() for e in obs.elements[:40]]},
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

    async def click(self, element_ref: str, label: str = "") -> ToolResult:
        t0 = time.monotonic()
        before_sig: PageSignature = await page_signature(self.page)
        before_url = self.page.url
        locator = self._locator(element_ref)
        if locator is None:
            return ToolResult(tool="click", ok=False, summary=f"Unknown element ref '{element_ref}'",
                              error="element_ref_not_found")
        try:
            await locator.click(timeout=8000)
            await self._settle()
            after_sig: PageSignature = await page_signature(self.page)
            url_changed = self.page.url != before_url
            if url_changed:
                self.current_origin = self._origin(self.page.url)
            report = verify_click(before_sig, after_sig, url_changed)
            await self.capture_screenshot()
            return ToolResult(
                tool="click", ok=True,
                summary=f"Clicked \"{(label or element_ref)[:60]}\"",
                data={"verified": report.verified, "verification": report.detail,
                      "url": self.page.url},
                duration_ms=int((time.monotonic() - t0) * 1000),
            )
        except Exception as e:
            return ToolResult(tool="click", ok=False, summary=f"Click failed on '{label or element_ref}'",
                              error=str(e)[:200], duration_ms=int((time.monotonic() - t0) * 1000))

    async def type_text(self, element_ref: str, text: str, label: str = "") -> ToolResult:
        t0 = time.monotonic()
        locator = self._locator(element_ref)
        if locator is None:
            return ToolResult(tool="type", ok=False, summary=f"Unknown element ref '{element_ref}'",
                              error="element_ref_not_found")
        try:
            await locator.click(timeout=5000)
            await locator.fill(text, timeout=5000)
            value = await locator.input_value(timeout=3000)
            verified = value == text
            await self.capture_screenshot()
            return ToolResult(
                tool="type", ok=True,
                summary=f"Typed {len(text)} characters into \"{(label or element_ref)[:50]}\"",
                data={"verified": verified,
                      "verification": "field value matches" if verified else "field value mismatch"},
                duration_ms=int((time.monotonic() - t0) * 1000),
            )
        except Exception as e:
            return ToolResult(tool="type", ok=False, summary=f"Typing failed on '{label or element_ref}'",
                              error=str(e)[:200], duration_ms=int((time.monotonic() - t0) * 1000))

    async def scroll(self, direction: str) -> ToolResult:
        t0 = time.monotonic()
        try:
            before, after = await self.page.evaluate(SCROLL_JS, direction)
            report = verify_scroll(before, after)
            await self.capture_screenshot()
            return ToolResult(tool="scroll", ok=True, summary=f"Scrolled {direction}",
                              data={"verified": report.verified},
                              duration_ms=int((time.monotonic() - t0) * 1000))
        except Exception as e:
            return ToolResult(tool="scroll", ok=False, summary="Scroll failed", error=str(e)[:200])

    async def wait_for_load(self) -> ToolResult:
        t0 = time.monotonic()
        try:
            await self._settle(max_wait_s=10)
            return ToolResult(tool="wait_for_load", ok=True, summary="Page settled",
                              data={"url": self.page.url},
                              duration_ms=int((time.monotonic() - t0) * 1000))
        except Exception as e:
            return ToolResult(tool="wait_for_load", ok=False, summary="Wait failed", error=str(e)[:200])

    async def screenshot(self) -> ToolResult:
        t0 = time.monotonic()
        ok = await self.capture_screenshot()
        return ToolResult(tool="screenshot", ok=ok, summary="Captured screenshot",
                          data={"captured": ok}, duration_ms=int((time.monotonic() - t0) * 1000))

    # -------------------------------------------------------------- internals
    async def _settle(self, max_wait_s: float = 4.0):
        """Give SPA/network activity a brief, bounded window to settle."""
        deadline = time.monotonic() + max_wait_s
        while time.monotonic() < deadline:
            try:
                if await self.page.evaluate("() => document.readyState") == "complete":
                    break
            except Exception:
                break
            await asyncio.sleep(0.15)
        await asyncio.sleep(0.25)

    async def capture_screenshot(self) -> bool:
        try:
            raw = await self.page.screenshot(type="jpeg", quality=55, timeout=8000)
            self.last_screenshot_b64 = base64.b64encode(raw).decode("ascii")
            self.screenshot_updated_at = time.time()
            return True
        except Exception:
            return False

    def _locator(self, ref: str):
        """Resolve an observation ref (e.g. 'e3') to a locator using the page's
        own element ordering (same enumeration as observe_page)."""
        try:
            idx = int(ref.lower().lstrip("e"))
        except ValueError:
            return None
        return self.page.locator(
            'a[href], button, input, select, textarea, [role="button"], [role="link"], '
            '[role="tab"], [role="checkbox"], [role="radio"], [role="textbox"], [type="submit"]'
        ).nth(idx)

    @staticmethod
    def _origin(url: str) -> str:
        from app.security.allowlist import URLNormalizer
        return URLNormalizer.origin_of(url) or ""


# singleton
browser_worker = BrowserWorker()
