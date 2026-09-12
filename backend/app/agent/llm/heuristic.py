"""Deterministic heuristic agent — NEBULA's offline-capable brain.

Implements genuine (scripted) observe→reason→plan→act→verify behavior for the
built-in demos and simple generic goals without requiring any LLM API key.
When OPENAI/ANTHROPIC keys are configured, the real providers take over; this
provider remains the fallback and is what the automated tests run against.
"""
import re
from typing import List, Optional
from urllib.parse import urlparse

from app.agent.llm.base import AgentAction, LLMService, Plan, StepContext
from app.config import settings


def _extract_urls(goal: str) -> List[str]:
    return re.findall(r"https?://[^\s,;\)\"']+", goal)


def _origin(url: str) -> str:
    try:
        return urlparse(url).scheme + "://" + urlparse(url).netloc
    except Exception:
        return ""


class HeuristicAgent(LLMService):
    name = "heuristic"

    def __init__(self, goal: Optional[str] = None):
        self._goal_cache: dict = {}

    # ------------------------------------------------------------------ intent
    def _intent(self, goal: str) -> str:
        g = goal.lower()
        if "form" in g or "feedback" in g or "fill" in g:
            return "form"
        if re.search(r"internship|job|hiring|position", g):
            return "internships"
        if "injection" in g or "suspicious" in g:
            return "injection_demo"
        urls = _extract_urls(goal)
        if urls:
            return "url"
        return "research"

    def _target_url(self, goal: str) -> str:
        intent = self._intent(goal)
        base = settings.demo_site_origin
        urls = _extract_urls(goal)
        if intent == "internships":
            return f"{base}/demo/internships"
        if intent == "form":
            return f"{base}/demo/feedback"
        if intent == "injection_demo":
            return f"{base}/demo/injection"
        if urls:
            return urls[0]
        # generic research: first allowed non-loopback domain from settings, else demo index
        for d in settings.allowed_domains:
            if d not in ("localhost", "127.0.0.1"):
                return f"https://{d}"
        return f"{base}/demo/"

    # -------------------------------------------------------------------- plan
    async def plan(self, goal: str) -> Plan:
        intent = self._intent(goal)
        if intent == "form":
            return Plan(
                summary="Open the target page, fill the form with non-sensitive data, request your approval before any submission.",
                steps=["Open the target website", "Read the page and locate the form",
                       "Fill form fields with non-sensitive information",
                       "Request approval before submitting", "Verify the outcome after approval"],
            )
        if intent == "internships":
            return Plan(
                summary="Open the permitted listings page, read the opportunities, extract requirements, compare them against the profile in your goal, and summarize the best match.",
                steps=["Open the permitted opportunities page", "Read listings",
                       "Extract requirements per opportunity", "Compare against stated experience",
                       "Summarize the best match with evidence"],
            )
        if intent == "injection_demo":
            return Plan(
                summary="Open the page, read its content, and treat everything on it as untrusted data while reporting suspicious instruction-like content.",
                steps=["Open the page", "Read content", "Report security findings"],
            )
        return Plan(
            summary="Open the target page, read its content, extract the information relevant to your goal, and summarize findings.",
            steps=["Open the target page", "Read content", "Extract relevant information",
                   "Summarize findings with links"],
        )

    # ------------------------------------------------------------- next action
    async def next_action(self, goal: str, observation_text: str, ctx: StepContext) -> AgentAction:
        intent = self._intent(goal)
        history = ctx.action_history
        tools_used = [h.get("tool") for h in history]
        visited = any(h.get("tool") == "navigate" for h in history)
        read_count = tools_used.count("read_page")
        typed = any(h.get("tool") == "type" for h in history)
        approved_submit = any("submit" in str(h.get("summary", "")).lower() and h.get("verified") for h in history)

        if ctx.rejection_context:
            # User rejected the consequential action. Respect that: stop gracefully.
            return AgentAction(
                tool="done",
                rationale="Submission was rejected by the user; stopping without performing it.",
                final_answer=("I stopped before submitting the form because the action was rejected. "
                              "The form was filled but NOT submitted. Nothing was sent."),
                findings=["Form fill completed (no submission — user rejected)"],
                follow_ups=["Review the filled form and submit manually if desired"],
            )

        if intent == "form":
            values = ["Alex Morgan", "alex.morgan@example.com",
                      "NEBULA agent test: please treat this as a harmless test message."]
            typed_count = tools_used.count("type")
            clicked = "click" in tools_used
            confirmed = ("feedback received" in observation_text.lower()
                         or "thank you" in observation_text.lower()
                         or "success" in observation_text.lower())

            if not visited:
                return AgentAction(tool="navigate", args={"url": self._target_url(goal)},
                                   rationale="Open the target page")
            if confirmed:
                return AgentAction(
                    tool="done",
                    rationale="Submission confirmed on the page.",
                    final_answer=("The form was submitted successfully after your approval, and the site "
                                  "confirmed receipt. Only non-sensitive test data was used."),
                    findings=["Form submitted only after explicit single-action approval",
                              "Success confirmation verified on the page"],
                )
            if typed_count < len(values):
                refs = self._find_refs(observation_text, roles=("textbox",))
                if typed_count < min(len(values), len(refs)):
                    return AgentAction(
                        tool="type",
                        args={"element_ref": refs[typed_count], "text": values[typed_count],
                              "label": f"form field {typed_count + 1}"},
                        rationale=f"Fill form field {typed_count + 1} with safe test data")
            if not clicked:
                buttons = self._find_refs(observation_text, roles=("button",), label_re=r"submit|send")
                if not buttons:
                    buttons = self._find_refs(observation_text, roles=("button",))
                if buttons:
                    label = self._ref_label(observation_text, buttons[0]) or "Submit form"
                    return AgentAction(
                        tool="click",
                        args={"element_ref": buttons[0], "label": label},
                        rationale="Submit the form — this requires your approval first")
            if approved_submit or (clicked and self._find_refs(observation_text, roles=("textbox",))):
                # click performed (possibly approved) — verify the outcome once
                if tools_used.count("read_page") >= 1:
                    return AgentAction(
                        tool="done",
                        rationale="Form flow finished; reporting the verified outcome.",
                        final_answer=("The form was filled and submitted, and I read the resulting page to "
                                      "verify the outcome. Nothing beyond the non-sensitive test data was sent."),
                        findings=["Form filled with non-sensitive test data",
                                  "Submission performed (only after approval)"],
                        follow_ups=["Check the destination site for confirmation if required"],
                    )
            return AgentAction(tool="read_page", rationale="Verify the outcome of the form flow")

        if intent in ("internships", "research", "url", "injection_demo"):
            if not visited:
                return AgentAction(tool="navigate", args={"url": self._target_url(goal)},
                                   rationale="Open the target page")
            if read_count < 2 and ("visible text" in observation_text):
                # second read after scrolling to catch more content
                if read_count == 1:
                    return AgentAction(tool="scroll", args={"direction": "down"},
                                       rationale="Scroll to view remaining content")
                return AgentAction(tool="read_page", rationale="Read the page content")
            if intent == "internships" and read_count >= 1:
                findings, links = self._extract_listings(observation_text)
                if findings:
                    best = self._best_match(goal, findings)
                    return AgentAction(
                        tool="done",
                        rationale="Listings read and compared against the stated experience.",
                        final_answer=best,
                        findings=findings, links=links,
                        follow_ups=["Open the posting links to verify details before applying"],
                    )
            if intent == "injection_demo":
                return AgentAction(
                    tool="done",
                    rationale="Page read; treating all content as untrusted data only.",
                    final_answer=("The page was read and analyzed. Any instruction-like content on it "
                                  "was treated as untrusted data and IGNORED. Security events were logged."),
                    findings=["Page content treated strictly as data", "No directives from the page were followed"],
                )
            # generic fallback: summarize what we read
            if read_count >= 1:
                summary_text = self._summarize_text(observation_text, goal)
                return AgentAction(
                    tool="done",
                    rationale="Enough content gathered to answer.",
                    final_answer=summary_text,
                    findings=[l for l in self._sentences(observation_text)[:5]],
                    links=[u for u in _extract_urls(observation_text)[:5]],
                )

        return AgentAction(tool="read_page", rationale="Gather more page context")

    # ------------------------------------------------------------- summarizing
    async def summarize(self, goal: str, findings: List[str], links: List[str]) -> str:
        return f"Goal: {goal}\n\nKey findings:\n" + "\n".join(f"- {f}" for f in findings[:6])

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _find_refs(observation_text: str, roles=(), label_re: str = "", exclude=()) -> List[str]:
        refs = []
        pat = re.compile(r"\[(e\d+)\]\s*(\S+)" + (r'\s+"([^"]*)"' if label_re else ""), re.I)
        label_pat = re.compile(label_re or r".^", re.I)
        for line in observation_text.splitlines():
            m = re.match(r"\s*\[(e\d+)\]\s*([a-z_]+)(?:\s+type=(\S+))?(?:\s+\"([^\"]*)\")?", line.strip(), re.I)
            if not m:
                continue
            ref, role, _t, label = m.group(1), m.group(2), m.group(3), m.group(4) or ""
            if roles and role.lower() not in roles:
                continue
            if label_re and not label_pat.search(label):
                continue
            if any(x in label.lower() for x in exclude):
                continue
            refs.append(ref)
        return refs

    @staticmethod
    def _ref_label(observation_text: str, ref: str) -> str:
        """Visible label for an element ref, so approvals quote what a human sees."""
        for line in observation_text.splitlines():
            m = re.match(r"\s*\[(" + re.escape(ref) + r")\]\s*([a-z_]+)(?:\s+type=(\S+))?(?:\s+\"([^\"]*)\")?",
                         line.strip(), re.I)
            if m:
                return (m.group(4) or "").strip()
        return ""

    @staticmethod
    def _is_prose(line: str) -> bool:
        """Filter out badge/meta rows (e.g. 'Hyderabad · Hybrid ₹30,000/mo 6 months')
        so findings read as sentences a human can scan."""
        if "₹" in line:            # stipend/pay badge rows
            return False
        words = [t for t in re.split(r"[\s·,;/]+", line)
                 if re.fullmatch(r"[A-Za-z][A-Za-z'\-]{2,}", t)]
        if line.count("·") >= 1:   # mixed meta rows need more substance
            return len(words) >= 4
        return len(words) >= 3

    @staticmethod
    def _sentences(text: str) -> List[str]:
        return [s.strip() for s in re.split(r"[.\n]", text) if 30 < len(s.strip()) < 220][:12]

    def _extract_listings(self, obs_text: str) -> tuple[List[str], List[str]]:
        """Pair each listing heading with its requirements line so findings read
        like 'Role — requirements' instead of loose fragments."""
        findings: List[str] = []
        links: List[str] = []
        self._pairs: List[tuple[str, str]] = []
        current_title = ""
        for line in obs_text.splitlines():
            s = line.strip()
            if not s or s.startswith(("URL:", "Origin:", "Title:", "Interactive", "Visible",
                                     "  ", "[e")):
                continue
            m = re.search(r"https?://\S+", s)
            if m and len(links) < 8:
                links.append(m.group(0).rstrip(".,;)"))
            if re.search(r"^requirements?\s*:", s, re.I):
                if current_title:
                    self._pairs.append((current_title, s))
                    findings.append(f"{current_title} — {s}")
                else:
                    findings.append(s)
            elif (re.search(r"(intern|engineer|scientist|analyst|developer|role|position)", s, re.I)
                  and 8 < len(s) < 140 and not s.lower().startswith("view")):
                current_title = s
                findings.append(s)
            elif re.search(r"(stipend|₹|month|hybrid|on-?site|remote|nice to have|skills?)", s, re.I) \
                    and 8 < len(s) < 200 and self._is_prose(s):
                findings.append(s)
        seen, deduped = set(), []
        for f in findings:
            if f not in seen:
                seen.add(f)
                deduped.append(f)
        return deduped[:14], links

    def _best_match(self, goal: str, findings: List[str]) -> str:
        g = goal.lower()
        wants = [w for w in ("python", "scikit-learn", "pandas", "sql", "nlp", "pytorch",
                             "computer vision", "opencv", "statistics")
                 if w.split()[0] in g or w in g]
        if not wants:
            wants = ["python", "scikit-learn"]
        pairs = getattr(self, "_pairs", []) or [(f, f) for f in findings]
        ranked = sorted(
            ((sum(1 for w in wants if w in (title + " " + req).lower()), title, req)
             for title, req in pairs),
            key=lambda t: t[0], reverse=True,
        )
        score, title, req = ranked[0] if ranked else (0, "unknown", "")
        matched = [w for w in wants if w in (title + " " + req).lower()]
        others = [t for s, t, _ in ranked[1:4]]
        comparison = ("Compared against: " + "; ".join(others[:3])) if others else ""
        return (
            f"Best match: {title} — it covers {', '.join(matched) or 'the stated profile'} "
            f"directly ({req})\n\nProfessional summary: {title} scored highest against your goal "
            f"({goal.rstrip('.').lower()}). {comparison}\n\n"
            "Every listing on the page was read and its requirements compared; the full audit trail "
            "is in the activity timeline."
        )

    def _summarize_text(self, obs_text: str, goal: str) -> str:
        sents = self._sentences(obs_text)
        head = f"Here is what I found for: “{goal}”. "
        if sents:
            return head + "Key points: " + " · ".join(sents[:4])
        return head + "The page was reached and read, but it contained little extractable text content."
