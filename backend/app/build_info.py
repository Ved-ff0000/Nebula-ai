"""Build identification — lets a running instance prove which code it is running.

Why this exists
---------------
A user reported the pre-fix failure message ("Browser unavailable: Browser could
not be started:") *after* the fix had been committed and pushed. Their uvicorn
process was simply still running the older code — nothing in the UI or the API
could tell them that, so the report looked like a regression when it was a stale
process.

Every response of the form "I applied the fix, but I still see the old
behaviour" costs a full debugging round-trip unless the running process can
state its own identity. So:

* ``/api/health`` and ``/api/health/browser`` now include a ``build`` object,
* the settings page and the browser-fix card print the commit,
* ``DIAGNOSTICS_REVISION`` is bumped whenever the failure-reporting format
  changes, so an old backend is recognisable even when it has no git metadata
  (e.g. a Docker image built without ``.git``).
"""

from __future__ import annotations

import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

# Bump when the shape of user-facing failure reporting changes. 2 = the
# actionable browser-launch diagnostics (reason + fix command, never empty).
DIAGNOSTICS_REVISION = 2

#: Features a client may rely on. Advertised so an older backend can be detected
#: by the UI itself instead of by comparing commits by hand.
FEATURES = (
    "browser_diagnostics_v1",   # /api/health/browser, /api/health/browser/test
    "actionable_launch_errors",  # never-empty, fix-included driver errors
    "build_identification",      # this module
)

_STARTED_AT = datetime.now(timezone.utc)
_REPO_ROOT = Path(__file__).resolve().parents[2]   # <repo>/backend/app/build_info.py -> <repo>


def _run_git(*args: str) -> str | None:
    try:
        proc = subprocess.run(
            ["git", "-C", str(_REPO_ROOT), *args],
            capture_output=True, text=True, timeout=2.5, check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout.strip() or None


def git_commit() -> str | None:
    """Explicit ``NEBULA_BUILD_COMMIT`` wins (Docker), else ask git, else None."""
    env = os.getenv("NEBULA_BUILD_COMMIT", "").strip()
    if env:
        return env
    return _run_git("rev-parse", "--short", "HEAD")


def is_dirty() -> bool:
    """True when the checkout has uncommitted changes — a common source of
    "I pulled but nothing changed" confusion."""
    if os.getenv("NEBULA_BUILD_COMMIT", "").strip():
        return False                    # baked at image build time
    status = _run_git("status", "--porcelain")
    return bool(status)


def started_at() -> str:
    return _STARTED_AT.isoformat(timespec="seconds")


def uptime_seconds() -> int:
    return int(time.time() - _STARTED_AT.timestamp())


def build_info() -> dict:
    """Structured identity of the running backend."""
    commit = git_commit()
    return {
        "commit": commit or "unknown",
        "dirty": is_dirty(),
        "started_at": started_at(),
        "uptime_seconds": uptime_seconds(),
        "diagnostics_revision": DIAGNOSTICS_REVISION,
        "features": list(FEATURES),
        "source": "env" if os.getenv("NEBULA_BUILD_COMMIT", "").strip() else "git",
    }


def one_line() -> str:
    """Human-readable identity for startup logs."""
    info = build_info()
    dirty = " (uncommitted changes)" if info["dirty"] else ""
    return (f"build {info['commit']}{dirty} · diagnostics revision "
            f"{info['diagnostics_revision']} · pid-started {info['started_at']}")
