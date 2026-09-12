"""NEBULA security/risk policy engine.

This layer sits between the AI model and every browser action. The model can
*propose* actions; only this engine decides whether they execute. The model
can never override policy, and BLOCKED actions never execute.

Risk model (per master spec §18):
  LOW     — public navigation, reading, scrolling, ordinary search, safe clicking
  MEDIUM  — entering ordinary non-sensitive user-provided info, minor UI changes
  HIGH    — submitting forms, sending messages, commitments, purchases*, account
           /security changes  (*purchases/financial are actually BLOCKED)
  BLOCKED — credentials/passwords, financial transactions, CAPTCHA bypass,
            destructive account actions, arbitrary code execution, spam
"""
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.security.allowlist import DomainAllowlist, URLNormalizer

TOOLS = {
    "navigate", "go_back", "read_page", "screenshot", "click",
    "type", "scroll", "wait_for_load",
}


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


@dataclass
class PolicyContext:
    task_id: str
    current_origin: Optional[str] = None
    task_domains: tuple = ()


@dataclass
class PolicyDecision:
    allowed: bool
    risk: RiskLevel
    reason: str
    rule_id: str
    requires_approval: bool = False
    details: dict = field(default_factory=dict)


# --- pattern tables -------------------------------------------------------
FINANCIAL = re.compile(
    r"\b(pay|payment|checkout|place\s+order|purchase|buy\s+now|subscribe|"
    r"credit\s*card|debit|bank\s+transfer|upi|send\s+money)\b", re.I)
CREDENTIAL = re.compile(
    r"\b(password|passwd|passcode|otp|one[-\s]?time\s+(code|password)|cvv|cvc|"
    r"credit\s*card\s+number|card\s+number|pin\b|secret\s+(key|token)|api[-\s]?key|"
    r"auth\s+token|login\s+code|2fa|two[-\s]?factor)\b", re.I)
DESTRUCTIVE = re.compile(
    r"\b(delete|close|deactivate|permanently\s+remove)\s+(my\s+|the\s+)?(account|profile)\b|"
    r"\bdelete\s+all\b", re.I)
COMMIT_SEND = re.compile(
    r"\b(submit|send|post|publish|reply|confirm|place|apply|sign\s*up|register|"
    r"enroll|book|reserve|order|accept|agree|consent|i\s+agree)\b", re.I)
CAPTCHA = re.compile(r"\b(captcha|are\s+you\s+human|verify\s+you\s+are\s+(not\s+)?a?\s*robot|bypass\s+verification)\b", re.I)
EXEC_INJECTION = re.compile(r"(javascript:|data:text/html|\bfetch\s*\(|\bXMLHttpRequest\b|\beval\s*\()", re.I)
SPAM = re.compile(r"\b(mass|bulk)\s+(email|message|dm|post|follow|like)|auto[-\s]?follow\b", re.I)


class PolicyEngine:
    """Stateless policy evaluator. Called before EVERY browser tool execution."""

    def __init__(self, allowlist: Optional[DomainAllowlist] = None):
        self.allowlist = allowlist or DomainAllowlist()

    # main entry point -----------------------------------------------------
    def check(self, action: dict, ctx: PolicyContext) -> PolicyDecision:
        tool = action.get("tool", "")
        args = action.get("args") or {}

        if tool not in TOOLS:
            return PolicyDecision(
                allowed=False, risk=RiskLevel.BLOCKED,
                reason=f"Tool '{tool}' is not part of NEBULA's audited toolset.",
                rule_id="unknown_tool",
            )
        if EXEC_INJECTION.search(str(args)):
            return PolicyDecision(
                allowed=False, risk=RiskLevel.BLOCKED,
                reason="Arguments attempt to inject executable code or non-HTTP content.",
                rule_id="exec_injection",
            )
        if SPAM.search(str(args)):
            return PolicyDecision(
                allowed=False, risk=RiskLevel.BLOCKED,
                reason="Arguments indicate bulk/mass automation which is prohibited.",
                rule_id="prohibited_automation",
            )

        handler = getattr(self, f"_check_{tool}")
        return handler(args, ctx)

    # per-tool checks --------------------------------------------------------
    def _check_navigate(self, args, ctx) -> PolicyDecision:
        url = URLNormalizer.normalize(str(args.get("url", "")))
        if not url:
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "Navigation target is not a valid http(s) URL.", "invalid_url")
        if not self.allowlist.is_allowed(url, ctx.task_domains):
            origin = URLNormalizer.origin_of(url)
            return PolicyDecision(
                False, RiskLevel.BLOCKED,
                f"Origin {origin} is not on this task's allowed domain list. "
                "Add the domain to your task permissions to permit it.",
                "domain_not_allowed", details={"origin": origin})
        return PolicyDecision(True, RiskLevel.LOW, "Public navigation on allowed domain.",
                              "navigate_allowed", details={"url": url})

    def _check_go_back(self, args, ctx) -> PolicyDecision:
        return PolicyDecision(True, RiskLevel.LOW, "Browser history navigation.", "go_back_allowed")

    def _check_read_page(self, args, ctx) -> PolicyDecision:
        return PolicyDecision(True, RiskLevel.LOW, "Reading public page content.", "read_allowed")

    def _check_screenshot(self, args, ctx) -> PolicyDecision:
        return PolicyDecision(True, RiskLevel.LOW, "Capturing visual snapshot.", "screenshot_allowed")

    def _check_scroll(self, args, ctx) -> PolicyDecision:
        direction = str(args.get("direction", "down")).lower()
        if direction not in ("up", "down", "top", "bottom"):
            return PolicyDecision(False, RiskLevel.BLOCKED, "Invalid scroll direction.", "invalid_scroll")
        return PolicyDecision(True, RiskLevel.LOW, "Scrolling page.", "scroll_allowed")

    def _check_wait_for_load(self, args, ctx) -> PolicyDecision:
        return PolicyDecision(True, RiskLevel.LOW, "Waiting for page load.", "wait_allowed")

    def _check_click(self, args, ctx) -> PolicyDecision:
        label = self._target_label(args)
        if CAPTCHA.search(label):
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "CAPTCHA solving/bypass is prohibited.", "captcha_blocked")
        if FINANCIAL.search(label):
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "Action appears to be a financial transaction (prohibited in V1).",
                                  "financial_blocked")
        if DESTRUCTIVE.search(label):
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "Destructive account actions are prohibited.", "destructive_blocked")
        if COMMIT_SEND.search(label):
            return PolicyDecision(
                True, RiskLevel.HIGH,
                f"Clicking '{label}' may submit or send information and requires explicit approval.",
                "click_requires_approval", requires_approval=True,
                details={"target_label": label})
        return PolicyDecision(True, RiskLevel.LOW, f"Safe click on '{label or 'element'}'.", "click_allowed")

    def _check_type(self, args, ctx) -> PolicyDecision:
        label = self._target_label(args)
        text = str(args.get("text", ""))
        if CREDENTIAL.search(label) or CREDENTIAL.search(text):
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "Entering passwords, OTPs, card numbers or secrets is prohibited.",
                                  "credential_blocked")
        if FINANCIAL.search(label):
            return PolicyDecision(False, RiskLevel.BLOCKED,
                                  "Entering payment/financial information is prohibited.",
                                  "financial_blocked")
        return PolicyDecision(
            True, RiskLevel.MEDIUM,
            f"Typing non-sensitive information into '{label or 'field'}'.",
            "type_medium", details={"field": label})

    # helpers -----------------------------------------------------------------
    @staticmethod
    def _target_label(args) -> str:
        """Human-readable description of the target element for rule matching.

        A visible label (what the user would read on the button/field) takes
        priority — internal element refs are only a fallback, and are never the
        text shown to the user in an approval request.
        """
        label = str(args.get("label", "")).strip()
        if label:
            return label
        parts = [str(args.get("element_ref", "")), str(args.get("selector", "")),
                 str(args.get("role", ""))]
        return " ".join(p for p in parts if p) or "unlabelled element"
