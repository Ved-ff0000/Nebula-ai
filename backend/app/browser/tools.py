"""Structured browser tools. The agent can ONLY use these granular tools —
no arbitrary JavaScript, shell, filesystem, or unrestricted network access.
Every tool validates arguments (Pydantic), enforces timeouts, returns
structured results, and is policy-checked by the orchestrator before execution.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ToolArgs(BaseModel):
    model_config = {"extra": "forbid"}


class NavigateArgs(ToolArgs):
    url: str = Field(min_length=1, max_length=2048)


class EmptyArgs(ToolArgs):
    pass


class ScrollArgs(ToolArgs):
    direction: Literal["up", "down", "top", "bottom"] = "down"


class ClickArgs(ToolArgs):
    element_ref: str = Field(min_length=1, max_length=16)
    label: str = Field(default="", max_length=200)   # human-readable target, used by policy
    role: str = Field(default="", max_length=40)


class TypeArgs(ToolArgs):
    element_ref: str = Field(min_length=1, max_length=16)
    text: str = Field(min_length=1, max_length=2000)
    label: str = Field(default="", max_length=200)
    role: str = Field(default="", max_length=40)
    submit_after: bool = False


ARG_MODELS = {
    "navigate": NavigateArgs,
    "go_back": EmptyArgs,
    "read_page": EmptyArgs,
    "screenshot": EmptyArgs,
    "click": ClickArgs,
    "type": TypeArgs,
    "scroll": ScrollArgs,
    "wait_for_load": EmptyArgs,
}


def validate_tool_call(tool: str, args: dict):
    """Returns (clean_args, error). Model output is validated before policy+execution."""
    model = ARG_MODELS.get(tool)
    if model is None:
        return None, f"Unknown tool '{tool}'"
    try:
        return model(**(args or {})), None
    except Exception as e:
        return None, f"Invalid arguments for {tool}: {e}"


class ToolResult(BaseModel):
    tool: str
    ok: bool
    summary: str
    data: dict = Field(default_factory=dict)
    duration_ms: int = 0
    error: Optional[str] = None
