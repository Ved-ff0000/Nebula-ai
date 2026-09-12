/**
 * Frontend component tests: task creation flow, status rendering, approval card
 * behaviour, result card honesty (no false success), timeline and theming.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskComposer } from "@/components/TaskComposer";
import { ApprovalCard } from "@/components/ApprovalCard";
import { ResultCard } from "@/components/ResultCard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StateMessage } from "@/components/StateMessage";
import { StatusPill } from "@/components/ui";
import { ToastProvider } from "@/components/Toast";
import type { Approval, TaskDetail, TaskEvent } from "@/lib/types";

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      createTask: vi.fn().mockResolvedValue({ id: "task-1", goal: "goal", status: "CREATED" }),
      startTask: vi.fn().mockResolvedValue({ id: "task-1" }),
      browser: vi.fn().mockResolvedValue({ available: false }),
    },
  };
});

import { api } from "@/lib/api";

const baseTask: TaskDetail = {
  id: "t1", goal: "Find internships in Hyderabad", status: "RUNNING",
  plan_summary: "Plan: research listings", current_step: 3, max_steps: 25, retry_count: 0,
  error: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  started_at: new Date().toISOString(), completed_at: null, domains: ["https://example.com"],
  events: [], approvals: [], result: null,
};

const event = (over: Partial<TaskEvent>): TaskEvent => ({
  id: Math.random().toString(36), task_id: "t1", timestamp: new Date().toISOString(),
  type: "action", summary: "Read page", status: "success", origin: "https://example.com",
  duration_ms: 120, metadata: {}, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("TaskComposer", () => {
  it("creates and starts a task from the goal input", async () => {
    wrap(<TaskComposer />);
    const box = screen.getByLabelText("Task goal");
    fireEvent.change(box, { target: { value: "Find machine learning internships in Hyderabad" } });
    fireEvent.click(screen.getByRole("button", { name: /run task/i }));
    await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(1));
    expect(api.startTask).toHaveBeenCalledWith("task-1");
  });

  it("refuses a goal that is too short", async () => {
    wrap(<TaskComposer />);
    fireEvent.change(screen.getByLabelText("Task goal"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /run task/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/more detail/i));
    expect(api.createTask).not.toHaveBeenCalled();
  });

  it("shows suggestion cards and the safety statement", () => {
    wrap(<TaskComposer />);
    expect(screen.getByText("Find opportunities")).toBeInTheDocument();
    expect(screen.getByText(/never permitted/i)).toBeInTheDocument();
  });

  it("passes per-task domain grants when configured", async () => {
    wrap(<TaskComposer />);
    fireEvent.change(screen.getByLabelText("Task goal"), { target: { value: "Research agent frameworks" } });
    fireEvent.click(screen.getByRole("button", { name: /permissions/i }));
    fireEvent.change(screen.getByLabelText(/allowed domains/i), { target: { value: "docs.python.org" } });
    fireEvent.click(screen.getByRole("button", { name: /run task/i }));
    await waitFor(() =>
      expect(api.createTask).toHaveBeenCalledWith("Research agent frameworks", ["docs.python.org"]));
  });
});

describe("ApprovalCard", () => {
  const approval: Approval = {
    id: "a1", task_id: "t1", action_id: "t1:4", risk_level: "HIGH",
    description: "Clicking 'Submit feedback' may submit information and requires approval.",
    target_origin: "http://localhost:8000", payload_summary: "Click 'Submit form'",
    status: "PENDING", requested_at: new Date().toISOString(), resolved_at: null,
  };

  it("shows the exact action, origin and single-action guarantee", () => {
    wrap(<ApprovalCard approval={approval} onApprove={vi.fn()} onReject={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText(/Approval required/i)).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8000")).toBeInTheDocument();
    expect(screen.getByText(/single action only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve once/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop task/i })).toBeInTheDocument();
  });

  it("forwards approve/reject decisions with the audit note", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    wrap(<ApprovalCard approval={approval} onApprove={onApprove} onReject={onReject} onStop={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/reviewed the form/i), { target: { value: "checked" } });
    fireEvent.click(screen.getByRole("button", { name: /approve once/i }));
    expect(onApprove).toHaveBeenCalledWith("checked");
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith("checked");
  });
});

describe("ResultCard", () => {
  it("renders a verified success with findings and evidence", () => {
    wrap(<ResultCard onNewTask={vi.fn()} task={{
      ...baseTask, status: "COMPLETED",
      result: {
        success: true, summary: "Best match: AgriSense AI", findings: ["Python; scikit-learn"],
        links: ["https://example.com/a"], follow_ups: [], confidence: 0.9,
        evidence: { check: "Evidence: 3 verified actions" },
      },
    }} />);
    expect(screen.getByText(/goal completed — verified/i)).toBeInTheDocument();
    expect(screen.getByText("AgriSense AI", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/evidence: 3 verified actions/i)).toBeInTheDocument();
  });

  it("never presents an unverified outcome as success", () => {
    wrap(<ResultCard onNewTask={vi.fn()} task={{
      ...baseTask, status: "FAILED",
      result: {
        success: false, summary: "Could not verify", findings: [], links: [], follow_ups: [],
        confidence: 0.2, evidence: {},
      },
    }} />);
    expect(screen.getByText(/goal not verified/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient evidence/i)).toBeInTheDocument();
  });
});

describe("ActivityTimeline", () => {
  it("renders audit entries with times and origins, newest first", () => {
    wrap(<ActivityTimeline events={[
      event({ id: "1", summary: "Opened website", status: "info" }),
      event({ id: "2", summary: "Navigation blocked by domain policy", type: "security", status: "blocked" }),
    ]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Navigation blocked by domain policy");
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getAllByText("https://example.com").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there is no activity", () => {
    wrap(<ActivityTimeline events={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });
});

describe("StatusPill & security states", () => {
  it("labels statuses for humans", () => {
    render(<StatusPill status="WAITING_FOR_APPROVAL" />);
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    render(<StatusPill status="BLOCKED" />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("explains blocked tasks and offers a next step", () => {
    render(<StateMessage task={{ ...baseTask, status: "BLOCKED", error: "Credentials are prohibited." }} />);
    expect(screen.getByText(/blocked by security policy/i)).toBeInTheDocument();
    expect(screen.getByText(/credentials are prohibited/i)).toBeInTheDocument();
    expect(screen.getByText(/next:/i)).toBeInTheDocument();
  });

  it("explains a browser-unavailable failure", () => {
    render(<StateMessage task={{ ...baseTask, status: "FAILED", error: "Browser could not be started" }} />);
    expect(screen.getByText(/browser unavailable/i)).toBeInTheDocument();
  });
});
