"""Typed request/response schemas (Pydantic v2) — consistent API contract."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------- auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="Operator", max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------- tasks
class TaskCreate(BaseModel):
    goal: str = Field(min_length=8, max_length=2000)
    allowed_domains: List[str] = Field(default_factory=list, max_length=20)

    @field_validator("allowed_domains")
    @classmethod
    def _sane_domains(cls, v):
        cleaned = []
        for d in v:
            d = d.strip().lower().rstrip("/")
            if d and not d.startswith(("/", ".")) and " " not in d and len(d) <= 253:
                cleaned.append(d)
        return cleaned


class TaskControlRequest(BaseModel):
    pass  # empty body accepted for control endpoints


class ApprovalDecisionRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


class TaskOut(BaseModel):
    id: str
    goal: str
    status: str
    plan_summary: Optional[str] = None
    current_step: int
    max_steps: int
    retry_count: int
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    domains: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TaskDetailOut(TaskOut):
    events: List["EventOut"] = Field(default_factory=list)
    approvals: List["ApprovalOut"] = Field(default_factory=list)
    result: Optional["ResultOut"] = None


class EventOut(BaseModel):
    id: str
    task_id: str
    timestamp: datetime
    type: str
    summary: str
    status: str
    origin: Optional[str] = None
    duration_ms: Optional[int] = None
    metadata: dict = Field(default_factory=dict)

    @classmethod
    def from_event(cls, ev) -> "EventOut":
        """Explicit mapping from the ORM row (SQLAlchemy reserves `.metadata`)."""
        return cls(id=ev.id, task_id=ev.task_id, timestamp=ev.timestamp, type=ev.type,
                   summary=ev.action_summary, status=ev.status, origin=ev.origin,
                   duration_ms=ev.duration_ms, metadata=ev.metadata_json or {})


class ApprovalOut(BaseModel):
    id: str
    task_id: str
    action_id: str
    risk_level: str
    description: str
    target_origin: str
    payload_summary: Optional[str] = None
    status: str
    requested_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResultOut(BaseModel):
    success: bool
    summary: str
    findings: list = Field(default_factory=list)
    links: list = Field(default_factory=list)
    follow_ups: list = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)
    confidence: float = 0.0

    model_config = {"from_attributes": True}


class BrowserStateOut(BaseModel):
    available: bool
    url: str = ""
    origin: str = ""
    title: str = ""
    status: str = "idle"
    screenshot: Optional[str] = None   # data URI
    updated_at: Optional[float] = None


class ActivityItemOut(BaseModel):
    task_id: str
    timestamp: datetime
    type: str
    summary: str
    status: str
    origin: Optional[str] = None


class AllowlistOut(BaseModel):
    global_domains: List[str]
    note: str = "V1 enforces an explicit domain allowlist. Per-task domains are added at task creation."


class AgentInfoOut(BaseModel):
    provider: str
    model: str
    browser_available: bool
    limits: dict


TokenResponse.model_rebuild()
TaskDetailOut.model_rebuild()
