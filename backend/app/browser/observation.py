"""Page observation: structured, bounded context for the agent.

Extracts URL/origin/title, truncated visible text, and interactive elements
with stable element refs (a11y labels/roles preserved). Screenshots are taken
when visual reasoning is needed. Page content is untrusted — the orchestrator
labels it via security.injection.wrap_untrusted before it reaches the model.
"""
from dataclasses import dataclass, field
from typing import List, Optional

from app.config import settings
from app.security.allowlist import URLNormalizer


@dataclass
class InteractiveElement:
    ref: str
    tag: str
    role: str = ""
    label: str = ""
    type: str = ""
    value: str = ""
    href_origin: str = ""
    disabled: bool = False

    def describe(self) -> str:
        bits = [f"[{self.ref}]"]
        bits.append(self.role or self.tag)
        if self.type:
            bits.append(f"type={self.type}")
        if self.label:
            bits.append(f'"{self.label[:60]}"')
        if self.value:
            bits.append(f"value=\"{self.value[:40]}\"")
        if self.href_origin:
            bits.append(f"({self.href_origin})")
        if self.disabled:
            bits.append("(disabled)")
        return " ".join(bits)


@dataclass
class Observation:
    url: str = ""
    origin: str = ""
    title: str = ""
    text: str = ""
    elements: List[InteractiveElement] = field(default_factory=list)
    error: Optional[str] = None

    def model_context(self, text_limit: int | None = None) -> str:
        """Compact textual rendering handed to the LLM (untrusted-content wrapped upstream)."""
        limit = text_limit or settings.observation_text_limit
        lines = [f"URL: {self.url}", f"Origin: {self.origin}", f"Title: {self.title}", "", "Interactive elements:"]
        if not self.elements:
            lines.append("  (none)")
        for el in self.elements:
            lines.append(f"  {el.describe()}")
        lines.append("")
        lines.append("Visible text (truncated):")
        lines.append(self.text[:limit] if self.text else "  (empty)")
        return "\n".join(lines)


# JS executed in the page to enumerate interactive elements.
_ENUMERATE_JS = """
(max) => {
  const selector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="textbox"], [type="submit"]';
  const nodes = Array.from(document.querySelectorAll(selector));
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    // refs stay index-stable against the raw selector list so locators can resolve them
    if (style.visibility === 'hidden' || style.display === 'none' || (rect.width === 0 && rect.height === 0)) continue;
    if (out.length >= max) break;
    const role = el.getAttribute('role') || ({A:'link', BUTTON:'button', INPUT: (el.type === 'submit' ? 'button' : 'textbox'), SELECT:'combobox', TEXTAREA:'textbox'})[el.tagName] || el.tagName.toLowerCase();
    let label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || (el.innerText || '').trim().replace(/\\s+/g, ' ') || el.getAttribute('title') || el.value || '';
    if (el.tagName === 'INPUT' && ['submit','button'].includes(el.type)) label = label || el.value || '';
    let hrefOrigin = '';
    if (el.tagName === 'A' && el.href) { try { hrefOrigin = new URL(el.href).origin; } catch (e) {} }
    out.push({
      ref: 'e' + i,
      tag: el.tagName.toLowerCase(),
      role, label: String(label).slice(0, 120), type: el.type || '',
      value: ['INPUT','TEXTAREA','SELECT'].includes(el.tagName) ? String(el.value || '').slice(0, 60) : '',
      hrefOrigin,
      disabled: !!el.disabled,
      top: Math.round(rect.top), left: Math.round(rect.left),
    });
  }
  out.sort((a, b) => (a.top - b.top) || (a.left - b.left));
  return out;
}
"""

_SCROLL_JS = "(dir) => { const y = window.scrollY; if (dir==='up') window.scrollBy(0,-600); else if (dir==='down') window.scrollBy(0,600); else if (dir==='top') window.scrollTo(0,0); else window.scrollTo(0, document.body.scrollHeight); return [y, window.scrollY]; }"


async def observe_page(page, max_elements: int | None = None) -> Observation:
    limit = max_elements or settings.max_interactive_elements
    try:
        url = page.url
        title = await page.title()
        elements_raw = await page.evaluate(_ENUMERATE_JS, limit)
        text = await page.evaluate("() => document.body ? document.body.innerText : ''")
        elements = [
            InteractiveElement(
                ref=e["ref"], tag=e["tag"], role=e.get("role", ""), label=e.get("label", ""),
                type=e.get("type", ""), value=e.get("value", ""),
                href_origin=e.get("hrefOrigin", ""), disabled=e.get("disabled", False),
            )
            for e in elements_raw
        ]
        return Observation(
            url=url, origin=URLNormalizer.origin_of(url) or "", title=title,
            text=text or "", elements=elements,
        )
    except Exception as e:  # page may be navigating/crashed
        return Observation(error=f"observation_failed: {type(e).__name__}")


SCROLL_JS = _SCROLL_JS
