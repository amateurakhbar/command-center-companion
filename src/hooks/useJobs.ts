import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { JobRow, JobInsert, JobUpdate, JobStatus } from "@/lib/jobs";
import { TaskRow } from "@/lib/tasks";

const KEY = ["jobs"] as const;
const TRASH_KEY = ["jobs", "trash"] as const;

export function useJobs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async (): Promise<JobRow[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .is("deleted_at", null)
        .order("priority", { ascending: true })
        .order("next_action_at", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeletedJobs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TRASH_KEY,
    enabled: !!user,
    queryFn: async (): Promise<JobRow[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJob(id: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["jobs", "detail", id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<JobRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Linked tasks for a given job (excludes deleted). */
export function useJobTasks(jobId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["jobs", "tasks", jobId],
    enabled: !!user && !!jobId,
    queryFn: async (): Promise<TaskRow[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("related_job_id", jobId)
        .is("deleted_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJobMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: TRASH_KEY });
    qc.invalidateQueries({ queryKey: ["jobs", "detail"] });
  };

  const createJob = useMutation({
    mutationFn: async (input: Omit<JobInsert, "user_id">) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("jobs")
        .insert({ ...input, user_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: JobUpdate }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restoreJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /* ---------- Status action helpers ---------- */

  async function markApplied(job: JobRow) {
    return updateJob.mutateAsync({
      id: job.id,
      patch: {
        status: "applied",
        applied_at: job.applied_at ?? new Date().toISOString(),
      },
    });
  }

  async function markRejected(job: JobRow, reason: string) {
    return updateJob.mutateAsync({
      id: job.id,
      patch: {
        status: "rejected",
        closed_at: new Date().toISOString(),
        closed_reason: reason,
      },
    });
  }

  async function markWithdrawn(job: JobRow, reason: string) {
    return updateJob.mutateAsync({
      id: job.id,
      patch: {
        status: "withdrawn",
        closed_at: new Date().toISOString(),
        closed_reason: reason,
      },
    });
  }

  async function setStatus(job: JobRow, status: JobStatus) {
    return updateJob.mutateAsync({ id: job.id, patch: { status } });
  }

  return {
    createJob,
    updateJob,
    deleteJob,
    restoreJob,
    markApplied,
    markRejected,
    markWithdrawn,
    setStatus,
  };
}

// Convenience aliases matching spec naming.
export const useCreateJob = () => useJobMutations().createJob;
export const useUpdateJob = () => useJobMutations().updateJob;
export const useDeleteJob = () => useJobMutations().deleteJob;
