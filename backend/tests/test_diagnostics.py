"""Regression tests for browser diagnostics.

The bug these exist to prevent (reported from a fresh clone):
    `Browser could not be started:` — with nothing after the colon — because
    Playwright raises a bare `TimeoutError()` on launch timeouts and
    `str(TimeoutError())` is `""`. The agent then told the user nothing, offered
    no remedy, and even logged a browser *teardown* event for a session that
    never existed.
"""
import pytest
from fastapi.testclient import TestClient

from app.browser.diagnostics import (
    BrowserDiagnostics, check_browser_environment, describe_exception, install_command,
)
from app.browser.worker import BrowserUnavailable, BrowserWorker


# ------------------------------------------------------------ never-empty text
@pytest.mark.parametrize("exc", [
    TimeoutError(),
    Exception(),
    ValueError(),
    OSError(),
    RuntimeError("chromium exited with code 127"),
    Exception("   "),                      # whitespace-only message
])
def test_describe_exception_is_never_empty(exc):
    text = describe_exception(exc)
    assert text and text.strip()
    assert type(exc).__name__ in text      # the type is always surfaced
    assert not text.endswith(":")          # the exact symptom that was reported


def test_describe_exception_uses_playwright_message_attribute():
    class FakePlaywrightError(Exception):
        message = "BrowserType.launch: Executable doesn't exist at /x/chrome"

    text = describe_exception(FakePlaywrightError())
    assert "Executable doesn't exist" in text
    assert "FakePlaywrightError" in text


def test_describe_exception_flags_bare_timeouts_helpfully():
    assert "launch timeout" in describe_exception(TimeoutError())


def test_describe_exception_strips_playwright_box_art():
    """Playwright wraps install hints in ASCII box art; it must not end up in
    the UI card — but the actual hint inside it must survive."""
    raw = (
        "BrowserType.launch: Executable doesn't exist at /x/chrome\n"
        "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n"
        "\u2551 Please run the following command:      \u2551\n"
        "\u2551     playwright install                   \u2551\n"
        "\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d"
    )
    text = describe_exception(Exception(raw))
    assert "\u2550" not in text and "\u2551" not in text
    assert "Executable doesn't exist" in text and "playwright install" in text
    assert text.count("\n") <= 6          # stays card-sized


def test_describe_exception_drops_the_playwright_signature_inside_the_box():
    """The sign-off sits *inside* the box, so it cannot be matched on the raw
    line — it must be matched after the borders are stripped."""
    raw = (
        "BrowserType.launch: Executable doesn't exist\n"
        "\u2551     playwright install                                     \u2551\n"
        "\u2551 <3 Playwright Team                                         \u2551"
    )
    text = describe_exception(Exception(raw))
    assert "<3" not in text
    assert "playwright install" in text
    assert "." not in text.splitlines()[-1].replace("install", "")  # no stray punctuation


def test_describe_exception_truncates_absurdly_long_output():
    text = describe_exception(Exception("x" * 5000))
    assert len(text) < 700 and text.endswith("\u2026")


# --------------------------------------------- the reported failure, reproduced
class _FakeChromium:
    async def launch(self, **kwargs):
        raise TimeoutError()          # bare, empty-str — exactly the reported case


class _FakePlaywright:
    chromium = _FakeChromium()


@pytest.mark.asyncio
async def test_launch_failure_message_is_actionable():
    """A launch failure must name the cause AND the fix — never a dangling colon."""
    worker = BrowserWorker()
    worker._pw = _FakePlaywright()          # skip driver start, go straight to launch

    with pytest.raises(BrowserUnavailable) as excinfo:
        await worker._ensure_browser()

    message = str(excinfo.value)
    assert message.strip() and not message.strip().endswith(":")
    assert "TimeoutError" in message                    # the real cause
    assert "Fix:" in message                            # a remedy is always offered
    assert "playwright install" in message              # and it is a real command
    assert worker.last_launch_error and worker.last_launch_error_type == "TimeoutError"


# ------------------------------------------------------- environment reporting
def test_environment_report_has_all_fields():
    diag = check_browser_environment()
    assert isinstance(diag, BrowserDiagnostics)
    payload = diag.to_dict()
    for key in ("ok", "platform", "python", "playwright_installed", "browser_installed",
                "browser_dirs", "headless_configured", "problem", "remedy"):
        assert key in payload
    if diag.ok:
        assert diag.problem is None and diag.remedy is None
    else:
        assert diag.problem and diag.remedy          # a problem always ships with a fix


def test_missing_package_yields_pip_remedy(monkeypatch):
    import app.browser.diagnostics as dg
    real_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

    def fake_import(name, *a, **kw):
        if name == "playwright" or name.startswith("playwright."):
            raise ModuleNotFoundError("No module named 'playwright'")
        return real_import(name, *a, **kw)

    monkeypatch.setattr("builtins.__import__", fake_import)
    diag = dg.check_browser_environment()
    assert diag.playwright_installed is False
    assert "requirements.txt" in diag.remedy


def test_missing_browser_yields_install_remedy(monkeypatch):
    import app.browser.diagnostics as dg
    monkeypatch.setattr(dg, "_find_installed_browsers", lambda: [])
    monkeypatch.setattr(dg, "_find_executable", lambda: None)
    diag = dg.check_browser_environment()
    assert diag.browser_installed is False
    assert "playwright install" in diag.remedy
    assert "chromium" in diag.remedy


def test_missing_system_libraries_yield_install_deps_remedy(monkeypatch):
    import app.browser.diagnostics as dg
    monkeypatch.setattr(dg, "_find_executable", lambda: dg.Path("/tmp/fake-chrome"))
    monkeypatch.setattr(dg, "_find_installed_browsers", lambda: ["chromium-1234"])
    monkeypatch.setattr(dg, "_missing_shared_libs", lambda exe: ["libnspr4.so", "libnss3.so"])
    diag = dg.check_browser_environment()
    assert diag.browser_installed is True
    assert diag.missing_system_libs == ["libnspr4.so", "libnss3.so"]
    assert "install-deps" in diag.remedy
    assert "libnspr4.so" in diag.problem


def test_runtime_failure_reports_last_error_with_remedy(monkeypatch):
    import app.browser.diagnostics as dg
    monkeypatch.setattr(dg, "_find_executable", lambda: dg.Path("/tmp/fake-chrome"))
    monkeypatch.setattr(dg, "_find_installed_browsers", lambda: ["chromium-1234"])
    monkeypatch.setattr(dg, "_missing_shared_libs", lambda exe: [])
    diag = dg.check_browser_environment(last_error="TimeoutError: no message",
                                        last_error_type="TimeoutError")
    assert diag.ok is False
    assert "TimeoutError" in diag.problem
    assert diag.remedy


def test_install_command_only_uses_with_deps_on_linux(monkeypatch):
    import app.browser.diagnostics as dg
    monkeypatch.setattr(dg.platform, "system", lambda: "Windows")
    assert "--with-deps" not in install_command(with_deps=True)
    monkeypatch.setattr(dg.platform, "system", lambda: "Linux")
    assert "--with-deps" in install_command(with_deps=True)


# ------------------------------------------------------------------- endpoints
def test_health_exposes_browser_readiness():
    from app.main import app
    with TestClient(app) as client:
        body = client.get("/api/health").json()
        assert body["status"] == "ok"
        assert "browser_connected" in body          # backwards compatible
        assert set(body["browser"]) >= {"driver_running", "environment_ok", "installed",
                                        "problem", "remedy"}


def test_browser_diagnostics_endpoint_returns_full_report():
    from app.main import app
    with TestClient(app) as client:
        r = client.get("/api/health/browser")
        assert r.status_code == 200
        body = r.json()
        assert "playwright_installed" in body and "browser_installed" in body
        assert "platform" in body and "browser_dirs" in body
        if body["ok"] is False:
            assert body["remedy"]        # an unhealthy report must include the fix
