"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { websocketUrl } from "@/lib/api";
import type { Approval, BrowserState, StreamState, TaskDetail } from "@/lib/types";

const ACTIVE = new Set(["CREATED", "PLANNING", "RUNNING", "WAITING_FOR_APPROVAL", "VERIFYING"]);

/**
 * Live task stream.
 *
 * Primary channel: WebSocket /ws/tasks/{id} (status, events, approvals).
 * Resilience: if the socket cannot connect, the hook falls back to polling so
 * the workspace is ALWAYS usable, and persists a "polling" connection state for
 * the UI. Reconnects use bounded exponential backoff. Because events are
 * persisted server-side, a reconnect replays the full timeline.
 */
export function useTaskStream(taskId: string | undefined) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [browser, setBrowser] = useState<BrowserState | null>(null);
  const [connection, setConnection] = useState<StreamState>("connecting");
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    try {
      const detail = await api.getTask(taskId);
      setTask(detail);
      setPendingApprovals(detail.approvals.filter((a) => a.status === "PENDING"));
      setError(null);
      // Browser state is fetched for every status: active tasks stream a live
      // frame, finished tasks return the last frame the agent saw (or offline).
      // A transient failure keeps the previous frame rather than clearing it.
      api.browser(taskId).then(setBrowser).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    }
  }, [taskId]);

  const startPolling = useCallback(
    (intervalMs = 1800) => {
      if (pollRef.current) return;
      setConnection((c) => (c === "live" ? c : "polling"));
      pollRef.current = setInterval(refresh, intervalMs);
    },
    [refresh],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    if (!taskId) return;
    closedRef.current = false;
    refresh();

    const connect = () => {
      if (closedRef.current) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(websocketUrl(taskId));
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;
      setConnection("connecting");

      ws.onopen = () => {
        retryRef.current = 0;
        setConnection("live");
        stopPolling();
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.kind === "event" || msg.kind === "status" || msg.kind === "approval") {
            refresh(); // persisted state is the single source of truth
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (closedRef.current) return;
        startPolling();
        retryRef.current += 1;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    const safety = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) startPolling();
    }, 2500);

    return () => {
      closedRef.current = true;
      clearTimeout(safety);
      stopPolling();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [taskId, refresh, startPolling, stopPolling]);

  // Keep refreshing while the task is active (covers approvals/step changes).
  useEffect(() => {
    if (!task) return;
    if (connection === "live") return;
    if (ACTIVE.has(task.status) && !pollRef.current) startPolling();
    if (!ACTIVE.has(task.status)) stopPolling();
  }, [task, connection, startPolling, stopPolling]);

  return { task, browser, connection, pendingApprovals, error, refresh };
}
