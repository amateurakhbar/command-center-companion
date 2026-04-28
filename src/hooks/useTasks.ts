import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  TaskRow,
  TaskInsert,
  TaskUpdate,
  TaskStatus,
} from "@/lib/tasks";

const KEY = ["tasks"] as const;

export function useTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("priority", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

const TRASH_KEY = ["tasks", "trash"] as const;

export function useDeletedTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TRASH_KEY,
    enabled: !!user,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: TRASH_KEY });
  };

  const create = useMutation({
    mutationFn: async (input: Omit<TaskInsert, "user_id">) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, user_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /* ---------- Action helpers (return prev snapshot for undo) ---------- */

  async function snapshot(id: string): Promise<TaskRow | null> {
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    return data ?? null;
  }

  async function markDone(task: TaskRow) {
    const prev = { status: task.status, completed_at: task.completed_at };
    await update.mutateAsync({
      id: task.id,
      patch: { status: "done", completed_at: new Date().toISOString() },
    });
    return prev;
  }

  async function reopen(task: TaskRow) {
    const prev = {
      status: task.status,
      completed_at: task.completed_at,
      killed_at: task.killed_at,
      killed_reason: task.killed_reason,
      deleted_at: task.deleted_at,
    };
    await update.mutateAsync({
      id: task.id,
      patch: {
        status: "to_do",
        completed_at: null,
        killed_at: null,
        killed_reason: null,
        deleted_at: null,
      },
    });
    return prev;
  }

  async function delay(task: TaskRow, hours: number) {
    const prev = { due_at: task.due_at, snoozed_until: task.snoozed_until, delay_count: task.delay_count, last_delayed_at: task.last_delayed_at };
    const newDue = new Date((task.due_at ? new Date(task.due_at).getTime() : Date.now()) + hours * 3600_000).toISOString();
    await update.mutateAsync({
      id: task.id,
      patch: {
        due_at: newDue,
        snoozed_until: newDue,
        delay_count: (task.delay_count ?? 0) + 1,
        last_delayed_at: new Date().toISOString(),
      },
    });
    return prev;
  }

  async function kill(task: TaskRow, reason?: string) {
    const prev = { status: task.status, killed_at: task.killed_at, killed_reason: task.killed_reason };
    await update.mutateAsync({
      id: task.id,
      patch: { status: "killed", killed_at: new Date().toISOString(), killed_reason: reason ?? null },
    });
    return prev;
  }

  async function setWaiting(task: TaskRow) {
    const prev = { status: task.status };
    await update.mutateAsync({ id: task.id, patch: { status: "waiting" } });
    return prev;
  }

  async function setStatus(task: TaskRow, status: TaskStatus) {
    const prev = { status: task.status };
    await update.mutateAsync({ id: task.id, patch: { status } });
    return prev;
  }

  async function reschedule(task: TaskRow, due_at: string | null) {
    const prev = { due_at: task.due_at };
    await update.mutateAsync({ id: task.id, patch: { due_at } });
    return prev;
  }

  async function breakDown(parent: TaskRow, subtaskTitles: string[]) {
    if (!user) throw new Error("Not signed in");
    const rows: TaskInsert[] = subtaskTitles
      .map((t) => t.trim())
      .filter(Boolean)
      .map((title) => ({
        user_id: user.id,
        title,
        parent_task_id: parent.id,
        priority: parent.priority,
        category: parent.category,
        related_job_id: parent.related_job_id,
        related_person_id: parent.related_person_id,
      }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) throw error;
    invalidate();
  }

  async function restoreFields(id: string, patch: TaskUpdate) {
    await update.mutateAsync({ id, patch });
  }

  return {
    create,
    update,
    softDelete,
    snapshot,
    markDone,
    reopen,
    delay,
    kill,
    setWaiting,
    setStatus,
    reschedule,
    breakDown,
    restoreFields,
  };
}
