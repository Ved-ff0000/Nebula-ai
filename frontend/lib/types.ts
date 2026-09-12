export type TaskStatus =
  | "CREATED" | "PLANNING" | "RUNNING" | "WAITING_FOR_APPROVAL" | "VERIFYING"
  | "COMPLETED" | "FAILED" | "CANCELLED" | "BLOCKED";

export type EventStatus = "info" | "success" | "failed" | "warning" | "blocked";

export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface Task {
  id: string;
  goal: string;
  status: TaskStatus;
  plan_summary: string | null;
  current_step: number;
  max_steps: number;
  retry_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  domains: string[];
}

export interface TaskEvent {
  id: string;
  task_id: string;
  timestamp: string;
  type: string;
  summary: string;
  status: EventStatus;
  origin: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface Approval {
  id: string;
  task_id: string;
  action_id: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  description: string;
  target_origin: string;
  payload_summary: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requested_at: string;
  resolved_at: string | null;
}

export interface TaskResult {
  success: boolean;
  summary: string;
  findings: string[];
  links: string[];
  follow_ups: string[];
  evidence: Record<string, unknown>;
  confidence: number;
}

export interface TaskDetail extends Task {
  events: TaskEvent[];
  approvals: Approval[];
  result: TaskResult | null;
}

export interface BrowserState {
  available: boolean;
  url: string;
  origin: string;
  title: string;
  status: string;
  screenshot: string | null;
  updated_at: number | null;
}

export interface ActivityItem {
  task_id: string;
  timestamp: string;
  type: string;
  summary: string;
  status: EventStatus;
  origin: string | null;
}

export interface AgentInfo {
  provider: string;
  model: string;
  browser_available: boolean;
  limits: {
    max_steps: number;
    max_task_minutes: number;
    max_retries: number;
    step_timeout_seconds: number;
    approval_timeout_seconds: number;
  };
}

export interface AllowlistInfo {
  global_domains: string[];
  note: string;
}

export type StreamState = "connecting" | "live" | "polling" | "offline";
