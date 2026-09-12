/**
 * Typed API client for the NEBULA backend.
 * All requests are same-origin (`/api/...`) — the frontend server proxies them
 * to the FastAPI backend, so no CORS or token leakage across origins.
 */
import type {
  ActivityItem, AgentInfo, AllowlistInfo, Approval, BrowserState, Task,
  TaskDetail, TaskEvent, User,
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

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>(
      "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  register: (email: string, password: string, display_name: string) =>
    request<{ access_token: string; user: User }>(
      "/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, display_name }) }, false),
  me: () => request<User>("/api/auth/me"),

  // tasks
  createTask: (goal: string, allowed_domains: string[] = []) =>
    request<Task>("/api/tasks", { method: "POST", body: JSON.stringify({ goal, allowed_domains }) }),
  listTasks: (params?: { q?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    return request<Task[]>(`/api/tasks${qs.toString() ? `?${qs}` : ""}`);
  },
  getTask: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  startTask: (id: string) => request<Task>(`/api/tasks/${id}/start`, { method: "POST" }),
  pauseTask: (id: string) => request<Task>(`/api/tasks/${id}/pause`, { method: "POST" }),
  resumeTask: (id: string) => request<Task>(`/api/tasks/${id}/resume`, { method: "POST" }),
  stopTask: (id: string) => request<Task>(`/api/tasks/${id}/stop`, { method: "POST" }),
  approve: (taskId: string, approvalId: string, reason = "") =>
    request<Approval>(`/api/tasks/${taskId}/approve/${approvalId}`,
      { method: "POST", body: JSON.stringify({ reason }) }),
  reject: (taskId: string, approvalId: string, reason = "") =>
    request<Approval>(`/api/tasks/${taskId}/reject/${approvalId}`,
      { method: "POST", body: JSON.stringify({ reason }) }),
  events: (taskId: string) => request<TaskEvent[]>(`/api/tasks/${taskId}/events`),
  browser: (taskId: string) => request<BrowserState>(`/api/tasks/${taskId}/browser`),

  // meta
  activity: () => request<ActivityItem[]>("/api/tasks/activity"),
  agentInfo: () => request<AgentInfo>("/api/settings/agent", {}, false),
  allowlist: () => request<AllowlistInfo>("/api/settings/allowlist", {}, false),
  health: () => request<{ status: string; llm_provider: string; browser_connected: boolean }>(
    "/api/health", {}, false),
};

export function websocketUrl(taskId: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/tasks/${taskId}`;
}
