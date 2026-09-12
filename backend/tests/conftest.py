"""Test configuration.

Unit/API tests run in-process against a temporary SQLite database with the
deterministic heuristic agent. The E2E test starts a real uvicorn server so the
Playwright browser can genuinely navigate to the built-in demo site.
"""
import os
import tempfile

# --- environment must be set before app modules import settings ---------------
_TMP = tempfile.mkdtemp(prefix="nebula-test-")
os.environ.setdefault("NEBULA_DATABASE_URL", f"sqlite:///{_TMP}/test.db")
os.environ.setdefault("NEBULA_LLM_PROVIDER", "heuristic")
os.environ.setdefault("NEBULA_SEED_DEMO_USER", "true")
os.environ.setdefault("NEBULA_MAX_STEPS", "12")
os.environ.setdefault("NEBULA_MAX_TASK_MINUTES", "3")
os.environ.setdefault("NEBULA_BROWSER_HEADLESS", "true")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
import httpx  # noqa: E402

from app.main import app  # noqa: E402


@pytest_asyncio.fixture(scope="function")
async def client():
    from app.database.db import init_db
    from app.services.seed import seed
    init_db()
    seed()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def auth(client):
    r = await client.post("/api/auth/login", json={
        "email": "demo@nebula.ai", "password": "nebula-demo-2024"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def fresh_user(client):
    import uuid
    email = f"tester-{uuid.uuid4().hex[:8]}@example.com"
    r = await client.post("/api/auth/register", json={
        "email": email, "password": "supersecret123", "display_name": "Tester"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
