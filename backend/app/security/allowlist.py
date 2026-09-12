"""Domain/origin allowlist control.

V1 uses an explicit allowlist. Before any navigation the URL is normalized,
its origin extracted, and compared against the effective permissions:
global allowlist (settings) + per-task extra domains.
"""
import re
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse

from app.config import settings


class URLNormalizer:
    @staticmethod
    def normalize(url: str) -> Optional[str]:
        """Return a cleaned http(s) URL or None if invalid/unsupported scheme."""
        if not url or not isinstance(url, str):
            return None
        url = url.strip()
        if url.startswith("//"):
            url = "https:" + url
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return url
        # scheme-less host like "example.com/path" or "localhost:8000/demo"
        if " " not in url and re.match(r"^[a-z0-9\-\.]+(:\d+)?([/?#]|$)", url, re.I):
            return "https://" + url
        return None

    @staticmethod
    def origin_of(url: str) -> Optional[str]:
        """Best-effort origin extraction. Non-HTTP(S) URLs (about:, data:, file:,
        javascript:, malformed ports) safely yield None."""
        if not url or not isinstance(url, str):
            return None
        parsed = urlparse(url if "://" in url else "https://" + url)
        if parsed.scheme not in ("http", "https"):
            return None
        try:
            port = parsed.port
            host = (parsed.hostname or "").lower()
        except ValueError:  # malformed host/port
            return None
        if not host:
            return None
        default = {"http": 80, "https": 443}.get(parsed.scheme)
        if port and port != default:
            return f"{parsed.scheme}://{host}:{port}"
        return f"{parsed.scheme}://{host}"


class DomainAllowlist:
    def __init__(self, global_domains: Optional[Iterable[str]] = None):
        self.global_domains = {self._clean(d) for d in (global_domains or settings.allowed_domains)}

    @staticmethod
    def _clean(domain: str) -> str:
        d = domain.strip().lower()
        for p in ("https://", "http://"):
            if d.startswith(p):
                d = d[len(p):]
        return d.rstrip("/")

    def _matches(self, origin: str, entry: str) -> bool:
        """Entry may be a registrable domain (matches subdomains) or an origin."""
        host = urlparse(origin).hostname or ""
        origin_no_port = origin.split("://", 1)[-1].split("/", 1)[0]
        return (
            host == entry
            or origin_no_port == entry
            or host.endswith("." + entry)
        )

    def is_allowed(self, url: str, task_domains: Iterable[str] = ()) -> bool:
        normalized = URLNormalizer.normalize(url)
        if not normalized:
            return False
        origin = URLNormalizer.origin_of(normalized)
        if not origin:
            return False
        allowed = set(self.global_domains) | {self._clean(d) for d in task_domains}
        # localhost loopback always restricted to explicitly listed hosts
        return any(self._matches(origin, entry) for entry in allowed)

    def effective_domains(self, task_domains: Iterable[str] = ()) -> list[str]:
        return sorted(set(self.global_domains) | {self._clean(d) for d in task_domains})
