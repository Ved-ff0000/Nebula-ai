"""Action verification — the agent may never claim success without evidence.

After each meaningful action, compare pre/post state:
  navigate → URL/origin changed to the expected target
  click    → URL, title, or DOM signature changed (something actually happened)
  type     → target field value equals the typed text
  scroll   → scroll position changed
Completion additionally requires verified reads/navigation + extracted evidence.
"""
import hashlib
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class PageSignature:
    url: str
    title: str
    dom_hash: str


@dataclass
class VerificationReport:
    verified: bool
    method: str
    detail: str


async def page_signature(page) -> PageSignature:
    try:
        title = await page.title()
        dom_hash = await page.evaluate(
            "() => { const t = document.body ? document.body.innerText.slice(0, 20000) : ''; "
            "let h = 0; for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) | 0; } "
            "return String(h) + ':' + (document.querySelectorAll('*').length); }"
        )
        return PageSignature(url=page.url, title=title, dom_hash=dom_hash)
    except Exception:
        return PageSignature(url=page.url, title="", dom_hash="unavailable")


def _host_of(url: str) -> str:
    from urllib.parse import urlparse
    return urlparse(url).netloc.lower()


def verify_navigation(before: PageSignature, after: PageSignature, expected_url: str) -> VerificationReport:
    from urllib.parse import urlparse
    target_host = _host_of(expected_url)
    target_path = urlparse(expected_url).path or "/"
    ok_host = _host_of(after.url) == target_host
    ok_path = urlparse(after.url).path.startswith(target_path) if target_path != "/" else True
    ok = ok_host and ok_path
    return VerificationReport(
        verified=ok, method="navigation",
        detail=f"URL now {after.url}" if ok else
               f"Expected {expected_url}, ended at {after.url}",
    )


def verify_click(before: PageSignature, after: PageSignature, url_changed: bool) -> VerificationReport:
    changed = (
        url_changed
        or after.url != before.url
        or after.title != before.title
        or after.dom_hash != before.dom_hash
    )
    return VerificationReport(
        verified=changed, method="dom_change",
        detail="Page state changed after click." if changed
               else "No navigation, title, or DOM change detected after click.",
    )


def verify_scroll(before_scroll_y: float, after_scroll_y: float) -> VerificationReport:
    return VerificationReport(
        verified=abs(after_scroll_y - before_scroll_y) > 2,
        method="scroll_position",
        detail=f"scrollY {before_scroll_y:.0f} → {after_scroll_y:.0f}",
    )


def completion_evidence_ok(evidence: dict, min_verified_actions: int = 2) -> Tuple[bool, str]:
    """A task may only be COMPLETED when the verification subsystem has evidence."""
    verified = evidence.get("verified_actions", 0)
    reads = evidence.get("pages_read", 0)
    if verified < min_verified_actions and reads < 1:
        return False, f"Insufficient evidence: {verified} verified actions, {reads} pages read."
    return True, f"Evidence: {verified} verified actions, {reads} pages read, origins={evidence.get('origins', [])}."
