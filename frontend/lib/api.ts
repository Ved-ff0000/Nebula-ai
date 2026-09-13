/**
 * Typed API client for the NEBULA backend.
 * All requests are same-origin (`/api/...`) — the frontend server proxies them
 * to the FastAPI backend, so no CORS or token leakage across origins.
 */
import type {
  ActivityItem, AgentInfo, AllowlistInfo, Approval, BrowserDiagnostics,
  BrowserLaunchTest, BrowserState, Task, TaskDetail, TaskEvent, User,
} from "./types";

const TOKEN_KEY = "nebula.token";
const USER_KEY = "nebula.user";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError("Cannot reach the NEBULA backend. Is it running?", 0);
  }
  if (res.status === 401 && auth) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* keep the default message */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type Api = {
  login: (email: string, password: string) => Promise<{ access_token: string; user: User }>;
  register: (email: string, password: string, display_name: string) =>
    Promise<{ access_token: string; user: User }>;
  me: () => Promise<User>;
  createTask: (
    goalOrPayload: string | { goal: string; domain?: string; allowed_domains?: string[] },
    allowed_domains?: string[],
  ) => Promise<Task>;
  listTasks: (params?: { q?: string; status?: string }) => Promise<Task[]>;
  listTasksCached: () => Task[];
  cacheTasks: (tasks: Task[]) => void;
  getTask: (id: string) => Promise<TaskDetail>;
  startTask: (id: string) => Promise<TaskDetail>;
  pauseTask: (id: string) => Promise<TaskDetail>;
  resumeTask: (id: string) => Promise<TaskDetail>;
  stopTask: (id: string) => Promise<TaskDetail>;
  approve: (taskId: string, approvalId: string, reason?: string) => Promise<Approval>;
  reject:  (taskId: string, approvalId: string, reason?: string) => Promise<Approval>;
  approveApproval: (approvalId: string) => Promise<Approval>;
  rejectApproval: (approvalId: string) => Promise<Approval>;
  getTaskEvents: (taskId: string) => Promise<TaskEvent[]>;
  events: (taskId: string) => Promise<TaskEvent[]>;
  browser: (taskId: string) => Promise<BrowserState>;
  activity: () => Promise<ActivityItem[]>;
  agentInfo: () => Promise<AgentInfo>;
  allowlist: () => Promise<AllowlistInfo>;
  health: () => Promise<{
    status: string;
    llm_provider: string;
    browser_connected: boolean;
    browser?: { driver_running: boolean; environment_ok: boolean; installed: boolean;
                problem: string | null; remedy: string | null };
  }>;
  browserDiagnostics: () => Promise<BrowserDiagnostics>;
  testBrowser: () => Promise<BrowserLaunchTest>;
};

export const api: Api = {
  // auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>(
      "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  register: (email: string, password: string, display_name: string) =>
    request<{ access_token: string; user: User }>(
      "/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, display_name }) }, false),
  me: () => request<User>("/api/auth/me"),

  // tasks — accept either (goal, allowedDomains[]) or ({goal, domain})
  createTask: (goalOrPayload: string | { goal: string; domain?: string; allowed_domains?: string[] }, allowed_domains: string[] = []) => {
    const payload =
      typeof goalOrPayload === "string"
        ? { goal: goalOrPayload, allowed_domains }
        : goalOrPayload;
    return request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
  },
  listTasks: (params?: { q?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    return request<Task[]>(`/api/tasks${qs.toString() ? `?${qs}` : ""}`);
  },
  /** Cache-first list for instant sidebar render; refreshes in the background. */
  listTasksCached(): Task[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("nebula.tasks.cache");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  cacheTasks(tasks: Task[]) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("nebula.tasks.cache", JSON.stringify(tasks.slice(0, 50))); } catch {}
  },
  getTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  startTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}/start`, { method: "POST" }),
  pauseTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}/pause`, { method: "POST" }),
  resumeTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}/resume`, { method: "POST" }),
  stopTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}/stop`, { method: "POST" }),
  approve: (taskId: string, approvalId: string, reason = "") =>
    request<Approval>(`/api/tasks/${taskId}/approve/${approvalId}`,
      { method: "POST", body: JSON.stringify({ reason }) }),
  reject: (taskId: string, approvalId: string, reason = "") =>
    request<Approval>(`/api/tasks/${taskId}/reject/${approvalId}`,
      { method: "POST", body: JSON.stringify({ reason }) }),
  /** Convenience wrappers — the workspace talks in approval ids. */
  approveApproval: (approvalId: string) => {
    const cached = readApprovalContext(approvalId);
    return api.approve(cached.taskId, approvalId);
  },
  rejectApproval: (approvalId: string) => {
    const cached = readApprovalContext(approvalId);
    return api.reject(cached.taskId, approvalId);
  },
  getTaskEvents: (taskId: string) => request<TaskEvent[]>(`/api/tasks/${taskId}/events`),
  /** Back-compat alias used by older code. */
  events: (taskId: string) => request<TaskEvent[]>(`/api/tasks/${taskId}/events`),
  browser: (taskId: string) => request<BrowserState>(`/api/tasks/${taskId}/browser`),

  // meta
  activity: () => request<ActivityItem[]>("/api/tasks/activity"),
  agentInfo: () => request<AgentInfo>("/api/settings/agent", {}, false),
  allowlist: () => request<AllowlistInfo>("/api/settings/allowlist", {}, false),
  health: () => request<{
    status: string;
    llm_provider: string;
    browser_connected: boolean;
    browser?: { driver_running: boolean; environment_ok: boolean; installed: boolean;
                problem: string | null; remedy: string | null };
  }>("/api/health", {}, false),
  browserDiagnostics: () => request<BrowserDiagnostics>("/api/health/browser", {}, false),
  testBrowser: () => request<BrowserLaunchTest>("/api/health/browser/test", { method: "POST" }, false),
};

/**
 * Tiny helper so the workspace can call approve(approvalId) without having
 * to thread the parent task id through every component. We remember the
 * (approvalId → taskId) mapping from the last TaskDetail we loaded.
 */
let _lastApprovalContext: Record<string, string> = {};
export function rememberApprovalContext(detail: TaskDetail | null) {
  if (!detail) return;
  for (const a of detail.approvals ?? []) {
    _lastApprovalContext[a.id] = detail.id;
  }
}
function readApprovalContext(approvalId: string): { taskId: string } {
  const taskId = _lastApprovalContext[approvalId];
  if (!taskId) throw new Error(`unknown approval ${approvalId} — refresh the page`);
  return { taskId };
}

export function websocketUrl(taskId: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/tasks/${taskId}`;
}
