"""The running process must be able to state which code it is running.

Motivation (real incident): a user reported the pre-fix "Browser could not be
started:" message while the fix was already committed — their process was simply
still running older code. Nothing in the UI or API could reveal that.
"""
import pytest
from fastapi.testclient import TestClient

from app.build_info import (DIAGNOSTICS_REVISION, FEATURES, build_info,
                            git_commit, is_dirty, one_line)
from app.main import app


def test_build_info_has_the_documented_shape():
    info = build_info()
    for key in ("commit", "dirty", "started_at", "uptime_seconds",
                "diagnostics_revision", "features", "source"):
        assert key in info, key
    assert isinstance(info["dirty"], bool)
    assert isinstance(info["uptime_seconds"], int)
    assert info["source"] in ("env", "git")


def test_build_info_never_returns_an_empty_commit():
    assert build_info()["commit"] not in ("", None)


def test_commit_falls_back_to_unknown_without_git(monkeypatch):
    """A Docker image built without .git must still say something usable."""
    monkeypatch.setenv("NEBULA_BUILD_COMMIT", "")
    monkeypatch.setattr("app.build_info._run_git", lambda *a: None)
    assert git_commit() is None
    assert build_info()["commit"] == "unknown"


def test_env_commit_wins_and_clears_dirty(monkeypatch):
    monkeypatch.setenv("NEBULA_BUILD_COMMIT", "deadbee")
    info = build_info()
    assert info["commit"] == "deadbee"
    assert info["dirty"] is False          # baked at image-build time
    assert info["source"] == "env"


def test_diagnostics_revision_tracks_the_feature_advertisement():
    assert DIAGNOSTICS_REVISION >= 2        # 2 = actionable launch errors
    assert "actionable_launch_errors" in FEATURES
    assert build_info()["features"] == list(FEATURES)


def test_one_line_is_log_friendly():
    line = one_line()
    assert line.startswith("build ") and "diagnostics revision" in line


def test_health_advertises_the_build():
    with TestClient(app) as client:
        health = client.get("/api/health").json()
        assert "build" in health
        assert health["build"]["diagnostics_revision"] == DIAGNOSTICS_REVISION
        assert "actionable_launch_errors" in health["build"]["features"]

        diag = client.get("/api/health/browser").json()
        assert diag["build"]["commit"] == health["build"]["commit"]
