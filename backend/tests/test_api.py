"""API tests: auth, task creation, state transitions, ownership isolation,
approval bypass attempts, pause/stop, and event persistence."""
import pytest

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------------- auth
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_login_rejects_bad_password(client, auth):
    r = await client.post("/api/auth/login", json={
        "email": "demo@nebula.ai", "password": "wrong-password"})
    assert r.status_code == 401


async def test_task_endpoints_require_auth(client):
    assert (await client.get("/api/tasks")).status_code == 401
    assert (await client.post("/api/tasks", json={"goal": "do something useful"})).status_code == 401


async def test_register_and_me(client):
    import uuid
    email = f"new-{uuid.uuid4().hex[:8]}@example.com"
    r = await client.post("/api/auth/register", json={
        "email": email, "password": "a-strong-password", "display_name": "New User"})
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == email


async def test_duplicate_registration_conflicts(client, auth):
    r = await client.post("/api/auth/register", json={
        "email": "demo@nebula.ai", "password": "another-password"})
    assert r.status_code == 409


# ---------------------------------------------------------------- task CRUD
async def test_create_task_persists_with_initial_event(client, auth):
    r = await client.post("/api/tasks", json={"goal": "Summarize the example.com homepage"},
                          headers=auth)
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["status"] == "CREATED" and task["current_step"] == 0
    detail = await client.get(f"/api/tasks/{task['id']}", headers=auth)
    assert detail.status_code == 200
    assert any(e["type"] == "status" for e in detail.json()["events"])


async def test_task_goal_validation(client, auth):
    assert (await client.post("/api/tasks", json={"goal": "hi"}, headers=auth)).status_code == 422


async def test_task_list_and_search(client, auth):
    await client.post("/api/tasks", json={"goal": "Find quantum computing news for me"}, headers=auth)
    r = await client.get("/api/tasks", params={"q": "quantum"}, headers=auth)
    assert r.status_code == 200 and any("quantum" in t["goal"] for t in r.json())
    r2 = await client.get("/api/tasks", params={"status": "CREATED"}, headers=auth)
    assert all(t["status"] == "CREATED" for t in r2.json())


async def test_task_ownership_isolation(client, auth, fresh_user):
    r = await client.post("/api/tasks", json={"goal": "Private task for owner only"}, headers=auth)
    task_id = r.json()["id"]
    # another user must not see or touch it
    assert (await client.get(f"/api/tasks/{task_id}", headers=fresh_user)).status_code == 404
    assert (await client.post(f"/api/tasks/{task_id}/start", headers=fresh_user)).status_code == 404
    listing = await client.get("/api/tasks", headers=fresh_user)
    assert all(t["id"] != task_id for t in listing.json())


# -------------------------------------------------- control + approval gates
async def test_pause_stop_require_running_task(client, auth):
    r = await client.post("/api/tasks", json={"goal": "Pause-state probe task"}, headers=auth)
    task_id = r.json()["id"]
    assert (await client.post(f"/api/tasks/{task_id}/pause", headers=auth)).status_code == 409
    assert (await client.post(f"/api/tasks/{task_id}/stop", headers=auth)).status_code == 200


async def test_approval_bypass_attempts_rejected(client, auth):
    """A client must never be able to approve a non-pending/foreign approval."""
    r = await client.post("/api/tasks", json={"goal": "Approval bypass probe task"}, headers=auth)
    task_id = r.json()["id"]
    # unknown approval id
    resp = await client.post(f"/api/tasks/{task_id}/approve/does-not-exist",
                             json={}, headers=auth)
    assert resp.status_code == 404
    # non-running task: no live approval gate → cannot be approved
    resp2 = await client.post(f"/api/tasks/{task_id}/approve/none",
                              json={}, headers=auth)
    assert resp2.status_code in (404, 409)


async def test_completed_task_cannot_restart(client, auth):
    from app.database.db import SessionLocal
    from app.database.models import Task
    r = await client.post("/api/tasks", json={"goal": "Restart guard probe task"}, headers=auth)
    task_id = r.json()["id"]
    db = SessionLocal()
    t = db.query(Task).filter(Task.id == task_id).one()
    t.status = "COMPLETED"
    db.commit()
    db.close()
    resp = await client.post(f"/api/tasks/{task_id}/start", headers=auth)
    assert resp.status_code == 409


async def test_events_and_browser_endpoints(client, auth):
    r = await client.post("/api/tasks", json={"goal": "Event stream probe task"}, headers=auth)
    task_id = r.json()["id"]
    events = await client.get(f"/api/tasks/{task_id}/events", headers=auth)
    assert events.status_code == 200 and len(events.json()) >= 1
    browser = await client.get(f"/api/tasks/{task_id}/browser", headers=auth)
    assert browser.status_code == 200
    assert browser.json()["available"] is False  # no live session yet


async def test_activity_feed_and_settings(client, auth):
    r = await client.get("/api/tasks/activity", headers=auth)
    assert r.status_code == 200
    info = await client.get("/api/settings/agent")
    assert info.status_code == 200 and "limits" in info.json()
    al = await client.get("/api/settings/allowlist")
    assert al.status_code == 200 and "example.com" in al.json()["global_domains"]
