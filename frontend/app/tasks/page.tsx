/**
 * /tasks — the workspace entry. Composer is visible when no task is
 * selected; clicking "Start task" pushes to /tasks/[id].
 */
"use client";
import { useRouter } from "next/navigation";
import { WorkspacePage } from "@/components/workspace/WorkspacePage";

export default function TasksPage() {
  const router = useRouter();
  return (
    <WorkspacePage
      taskId={null}
      onTaskCreated={(id) => router.push(`/tasks/${id}`)}
    />
  );
}
