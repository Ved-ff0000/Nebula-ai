"""OpenAI + Anthropic providers (structured JSON tool calling) and factory.

Keys stay server-side, model outputs are schema-validated, and both providers
receive the same security contract (SYSTEM_CONTRACT) with untrusted-content
labeling. If a provider is misconfigured/fails at runtime the orchestrator
falls back to the deterministic heuristic agent and the degradation is logged
as a task event.
"""
import json
import logging
from typing import Optional

import httpx

from app.agent.llm.base import (
    SYSTEM_CONTRACT, AgentAction, LLMError, LLMService, Plan, StepContext,
)
from app.agent.llm.heuristic import HeuristicAgent
from app.config import settings

log = logging.getLogger("nebula.llm")

_TOOLS_JSON = json.dumps({
    "navigate": {"url": "https://…"}, "go_back": {}, "read_page": {}, "screenshot": {},
    "click": {"element_ref": "e3", "label": "visible label", "role": "button"},
    "type": {"element_ref": "e5", "text": "…", "label": "field label"},
    "scroll": {"direction": "down|up|top|bottom"}, "wait_for_load": {},
    "done": {"final_answer": "…", "findings": ["…"], "links": ["…"], "follow_ups": ["…"]},
}, indent=2)


class OpenAIProvider(LLMService):
    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str):
        if not api_key:
            raise LLMError("OPENAI_API_KEY not configured")
        self.api_key, self.model, self.base_url = api_key, model, base_url.rstrip("/")

    async def _chat(self, messages, max_tokens=1200) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "temperature": 0.1,
                      "max_tokens": max_tokens, "response_format": {"type": "json_object"}},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def plan(self, goal: str) -> Plan:
        content = await self._chat([
            {"role": "system", "content": SYSTEM_CONTRACT},
            {"role": "user", "content":
                f"Goal: {goal}\n\nProduce a short plan as JSON: "
                "{\"summary\": str, \"steps\": [str, …]} (max 8 steps)."},
        ])
        return Plan(**json.loads(content))

    async def next_action(self, goal: str, observation_text: str, ctx: StepContext) -> AgentAction:
        content = await self._chat([
            {"role": "system", "content": SYSTEM_CONTRACT},
            {"role": "user", "content": (
                f"Goal: {goal}\nStep {ctx.step}/{ctx.max_steps}\n"
                f"History: {json.dumps(ctx.action_history[-10:])}\n"
                + (f"NOTE — the user REJECTED an action: {ctx.rejection_context}. "
                   "Adapt respectfully and do not attempt it again unchanged.\n" if ctx.rejection_context else "")
                + f"\n{observation_text}\n\n"
                + 'Choose ONE next action as JSON with keys "tool" (one of the tools below or "done"), '
                + '"args", and "rationale" (short user-facing intent).\nTools: ' + _TOOLS_JSON)},
        ])
        return AgentAction(**json.loads(content))

    async def summarize(self, goal: str, findings, links) -> str:
        content = await self._chat([
            {"role": "system", "content": SYSTEM_CONTRACT},
            {"role": "user", "content":
                f"Goal: {goal}\nFindings: {json.dumps(findings)}\n"
                f"Write a concise final answer (max 180 words)."},
        ], max_tokens=400)
        return content.strip()


class AnthropicProvider(LLMService):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise LLMError("ANTHROPIC_API_KEY not configured")
        self.api_key, self.model = api_key, model

    async def _message(self, user_prompt: str, max_tokens: int = 1200) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                json={"model": self.model, "max_tokens": max_tokens, "temperature": 0.1,
                      "system": SYSTEM_CONTRACT,
                      "messages": [{"role": "user", "content": user_prompt}]},
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]

    @staticmethod
    def _parse_json(text: str) -> dict:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            raise LLMError("Model returned non-JSON output")
        return json.loads(text[start:end + 1])

    async def plan(self, goal: str) -> Plan:
        content = await self._message(
            f"Goal: {goal}\n\nProduce a short plan as JSON: {{\"summary\": str, \"steps\": [str, …]}} (max 8).")
        return Plan(**self._parse_json(content))

    async def next_action(self, goal: str, observation_text: str, ctx: StepContext) -> AgentAction:
        content = await self._message(
            f"Goal: {goal}\nStep {ctx.step}/{ctx.max_steps}\n"
            f"History: {json.dumps(ctx.action_history[-10:])}\n"
            + (f"NOTE — the user REJECTED an action: {ctx.rejection_context}. Adapt respectfully.\n"
               if ctx.rejection_context else "")
            + f"\n{observation_text}\n\nChoose ONE next action as JSON: "
              "{\"tool\": one of navigate|go_back|read_page|screenshot|click|type|scroll|wait_for_load|done, "
              "\"args\": …, \"rationale\": short user-facing intent}. Tools schema: " + _TOOLS_JSON,
        )
        return AgentAction(**self._parse_json(content))

    async def summarize(self, goal: str, findings, links) -> str:
        content = await self._message(
            f"Goal: {goal}\nFindings: {json.dumps(findings)}\n"
            f"Write a concise final answer (max 180 words).", max_tokens=400)
        return content.strip()


def get_llm_service() -> LLMService:
    provider = (settings.llm_provider or "heuristic").lower()
    try:
        if provider == "openai":
            return OpenAIProvider(settings.openai_api_key, settings.openai_model, settings.openai_base_url)
        if provider == "anthropic":
            return AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
    except LLMError as e:
        log.warning("LLM provider '%s' unavailable (%s); falling back to heuristic agent.", provider, e)
    return HeuristicAgent()
