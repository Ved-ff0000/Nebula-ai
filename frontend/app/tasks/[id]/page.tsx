/**
 * /tasks/[id] — three-zone workspace bound to a real task.
 */
"use client";
import { useParams } from "next/navigation";
import { WorkspacePage } from "@/components/workspace/WorkspacePage";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  return <WorkspacePage taskId={params?.id ?? null} />;
}
