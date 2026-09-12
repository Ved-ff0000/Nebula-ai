"""Browser preflight diagnostics.

"Browser could not be started" is a useless message. This module turns a launch
failure into a precise, actionable answer: what is missing, how to confirm it,
and the exact command that fixes it on *this* machine.

Why it exists (real bug, reported from a fresh clone):
    Playwright raises a bare `TimeoutError()` when a launch times out, and
    `str(TimeoutError())` is `""`. The old code interpolated the exception
    directly, so the UI showed "Browser could not be started:" with nothing
    after the colon. `describe_exception()` below can never return an empty
    string, and every failure now carries a remedy.
"""
from __future__ import annotations

import asyncio
import glob
import os
import platform
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import List, Optional

# ---------------------------------------------------------------------------
# remediation commands
# ---------------------------------------------------------------------------
_INSTALL_BROWSER = "python -m playwright install chromium"
_INSTALL_BROWSER_WITH_DEPS = "python -m playwright install --with-deps chromium"
_INSTALL_PACKAGE = "pip install -r backend/requirements.txt"
_INSTALL_DEPS_LINUX = "sudo python -m playwright install-deps chromium"


def install_command(with_deps: bool = False) -> str:
    """Fix command for this platform. `--with-deps` is Linux-only (it shells
    out to apt/dnf); on Windows/macOS Playwright has no system deps to install."""
    if with_deps and platform.system() == "Linux":
        return _INSTALL_BROWSER_WITH_DEPS
    return _INSTALL_BROWSER


def browser_cache_dirs() -> List[Path]:
    """Where Playwright keeps downloaded browsers (mirrors its own lookup)."""
    env = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env and env != "0":
        return [Path(env)]
    home = Path.home()
    system = platform.system()
    if system == "Darwin":
        return [home / "Library" / "Caches" / "ms-playwright"]
    if system == "Windows":
        local = os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")
        return [Path(local) / "ms-playwright"]
    return [home / ".cache" / "ms-playwright"]


def _find_installed_browsers() -> List[str]:
    found: List[str] = []
    for base in browser_cache_dirs():
        if not base.is_dir():
            continue
        for entry in sorted(base.iterdir()):
            if entry.name.startswith("chromium") and entry.is_dir():
                found.append(entry.name)
    return found


def _executable_candidates() -> List[Path]:
    """Standard relative paths of the Chromium binary inside a browser dir."""
    rel = [
        "chrome-linux/chrome",
        "chrome-linux64/chrome",
        "chrome-headless-shell-linux64/chrome-headless-shell",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
        "chrome-win/chrome.exe",
        "chrome-headless-shell-win64/chrome-headless-shell.exe",
    ]
    out: List[Path] = []
    for base in browser_cache_dirs():
        for name in _find_installed_browsers():
            for r in rel:
                out.append(base / name / r)
    return out


def _find_executable() -> Optional[Path]:
    for candidate in _executable_candidates():
        if candidate.is_file():
            return candidate
    return None


def _missing_shared_libs(executable: Path) -> List[str]:
    """Linux only: report shared libraries the binary cannot resolve.
    A freshly downloaded Chromium on a bare container typically fails here
    (libnspr4, libnss3, ...) — which Playwright surfaces as a launch crash."""
    if platform.system() != "Linux":
        return []
    try:
        proc = subprocess.run(["ldd", str(executable)], capture_output=True, text=True, timeout=20)
    except Exception:
        return []
    missing = []
    for line in (proc.stdout or "").splitlines():
        if "=> not found" in line:
            missing.append(line.split("=>")[0].strip())
    return sorted(set(missing))


# ---------------------------------------------------------------------------
# exception rendering — never empty
# ---------------------------------------------------------------------------
_BOX_CHARS = set("═║╔╗╚╝╠╣╬─│┌┐└┘━┃┏┓┗┛┣┫┳┻╋▏▕")


def _sanitise(text: str, limit: int = 600) -> str:
    """Strip Playwright's decorative box-art and collapse whitespace so the
    message stays readable inside a UI card."""
    kept: list[str] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if len(stripped) > 3 and sum(c in _BOX_CHARS for c in stripped) / len(stripped) > 0.4:
            continue                      # a box-drawing border line
        content = stripped.strip("".join(_BOX_CHARS) + " ").strip()   # unbox "║ text ║"
        if content.lower().startswith("<3 "):        # Playwright's sign-off line
            continue
        if content:
            kept.append(content)
    out = "\n".join(kept).strip()
    out = "\n".join(line for line in out.splitlines() if line)
    return (out[: limit - 1] + "…") if len(out) > limit else out


def describe_exception(exc: BaseException) -> str:
    """Human-readable, never-empty description of an exception.

    Order of preference: str(exc) → exc.message (Playwright sets this) → args →
    an explicit placeholder naming the type. The type name is always included so
    even a bare `TimeoutError()` is diagnosable.
    """
    name = type(exc).__name__
    text = ""
    try:
        text = str(exc).strip()
    except Exception:
        text = ""
    if not text:
        message = getattr(exc, "message", None)
        if isinstance(message, str):
            text = message.strip()
    if not text:
        args = [repr(a)[:300] for a in getattr(exc, "args", ()) if a not in (None, "")]
        text = " | ".join(args)
    if not text:
        text = "the browser driver reported no message (typical for a launch timeout)"
    return f"{name}: {_sanitise(text)}"


# ---------------------------------------------------------------------------
# environment check
# ---------------------------------------------------------------------------
@dataclass
class BrowserDiagnostics:
    ok: bool
    platform: str
    python: str
    playwright_installed: bool
    playwright_version: Optional[str] = None
    browser_installed: bool = False
    browser_dirs: List[str] = field(default_factory=list)
    executable_path: Optional[str] = None
    missing_system_libs: List[str] = field(default_factory=list)
    headless_configured: bool = True
    last_launch_error: Optional[str] = None
    last_launch_error_type: Optional[str] = None
    problem: Optional[str] = None
    remedy: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def check_browser_environment(last_error: Optional[str] = None,
                              last_error_type: Optional[str] = None) -> BrowserDiagnostics:
    """Fast, side-effect-free check (no browser launch, no driver spawn) so it is
    safe to call from health checks. Performs an actual launch only in
    `run_launch_test()`."""
    from app.config import settings

    diag = BrowserDiagnostics(
        ok=False,
        platform=f"{platform.system()} {platform.release()} ({platform.machine()})",
        python=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        playwright_installed=False,
        headless_configured=settings.browser_headless,
        last_launch_error=last_error,
        last_launch_error_type=last_error_type,
    )

    try:
        import playwright  # noqa: F401
        from importlib.metadata import version as _pkg_version, PackageNotFoundError
        diag.playwright_installed = True
        try:
            diag.playwright_version = _pkg_version("playwright")
        except PackageNotFoundError:
            diag.playwright_version = None
    except Exception:
        diag.playwright_installed = False
        diag.problem = "The Python package 'playwright' is not installed in this interpreter."
        diag.remedy = _INSTALL_PACKAGE
        return diag

    diag.browser_dirs = [str(p) for p in browser_cache_dirs()]
    installed = _find_installed_browsers()
    executable = _find_executable()
    diag.browser_installed = executable is not None
    diag.executable_path = str(executable) if executable else None

    if not diag.browser_installed:
        diag.problem = ("Playwright is installed but no Chromium download was found"
                        + (f" (looked in: {', '.join(diag.browser_dirs)})" if diag.browser_dirs else "")
                        + ".")
        diag.remedy = install_command(with_deps=True)
        return diag

    diag.missing_system_libs = _missing_shared_libs(executable)
    if diag.missing_system_libs:
        diag.problem = ("Chromium is downloaded but the operating system is missing shared "
                        f"libraries: {', '.join(diag.missing_system_libs)}.")
        diag.remedy = _INSTALL_DEPS_LINUX
        return diag

    if last_error:
        # Browser binary and libraries are fine, so the failure was runtime:
        # sandbox/permissions/resource contention or a transient crash.
        diag.problem = f"The browser binary is present but the last launch failed: {last_error}"
        diag.remedy = (
            "Re-run the task; if it keeps failing, run `python -m playwright install --with-deps "
            "chromium` (Linux) or the diagnostic script `python backend/scripts/diagnose.py` for "
            "details. Sandbox/antivirus interference and low shared memory are common causes."
        )
        return diag

    diag.ok = True
    return diag


async def run_launch_test(timeout_s: float = 45.0) -> dict:
    """Actually launch Chromium and load a page. Returns the precise outcome —
    this is the only check that proves the browser works on this machine."""
    from app.browser.worker import describe_exception as _describe  # noqa: F401  (single source)
    from app.config import settings

    result: dict = {"launched": False, "loaded_page": False, "duration_ms": None,
                    "error": None, "error_type": None, "remedy": None}
    import time
    t0 = time.monotonic()
    pw = None
    browser = None
    try:
        from playwright.async_api import async_playwright
        pw = await asyncio.wait_for(async_playwright().start(), timeout=timeout_s)
        browser = await asyncio.wait_for(
            pw.chromium.launch(headless=settings.browser_headless,
                               args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]),
            timeout=timeout_s,
        )
        result["launched"] = True
        page = await asyncio.wait_for(browser.new_page(), timeout=timeout_s)
        await asyncio.wait_for(
            page.set_content("<h1>NEBULA browser preflight</h1>"), timeout=timeout_s)
        result["loaded_page"] = bool(await page.title() is not None)
    except asyncio.TimeoutError:
        result["error_type"] = "TimeoutError"
        result["error"] = (f"Launch exceeded {timeout_s:.0f}s. A hanging launch usually means the "
                           "driver cannot start Chromium (sandbox restrictions, missing system "
                           "libraries, or antivirus interference).")
    except Exception as exc:  # noqa: BLE001 — surface everything to the operator
        result["error_type"] = type(exc).__name__
        result["error"] = describe_exception(exc)
    finally:
        try:
            if browser:
                await browser.close()
            if pw:
                await pw.stop()
        except Exception:
            pass
        result["duration_ms"] = int((time.monotonic() - t0) * 1000)

    if not (result["launched"] and result["loaded_page"]):
        env = check_browser_environment(result["error"], result["error_type"])
        result["remedy"] = env.remedy or install_command(with_deps=True)
    return result
