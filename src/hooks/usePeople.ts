import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  PersonRow,
  PersonInsert,
  PersonUpdate,
  PersonStatus,
} from "@/lib/people";
import { TaskRow } from "@/lib/tasks";

const KEY = ["people"] as const;
const TRASH_KEY = ["people", "trash"] as const;

export function usePeople() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async (): Promise<PersonRow[]> => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .is("deleted_at", null)
        .order("priority", { ascending: true })
        .order("next_follow_up_at", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeletedPeople() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TRASH_KEY,
    enabled: !!user,
    queryFn: async (): Promise<PersonRow[]> => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePerson(id: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["people", "detail", id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<PersonRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePersonTasks(personId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["people", "tasks", personId],
    enabled: !!user && !!personId,
    queryFn: async (): Promise<TaskRow[]> => {
      if (!personId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("related_person_id", personId)
        .is("deleted_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** People tied to a specific job. */
export function useJobPeople(jobId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["people", "by-job", jobId],
    enabled: !!user && !!jobId,
    queryFn: async (): Promise<PersonRow[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("related_job_id", jobId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePersonMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: TRASH_KEY });
    qc.invalidateQueries({ queryKey: ["people", "detail"] });
    qc.invalidateQueries({ queryKey: ["people", "by-job"] });
  };

  const createPerson = useMutation({
    mutationFn: async (input: Omit<PersonInsert, "user_id">) => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("people")
        .insert({ ...input, user_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updatePerson = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PersonUpdate }) => {
      const { data, error } = await supabase
        .from("people")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("people")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restorePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("people")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /* ---- Action helpers ---- */

  async function setStatus(person: PersonRow, status: PersonStatus) {
    return updatePerson.mutateAsync({ id: person.id, patch: { status } });
  }

  async function markContacted(person: PersonRow) {
    return updatePerson.mutateAsync({
      id: person.id,
      patch: { status: "contacted", last_contacted_at: new Date().toISOString() },
    });
  }

  async function markReplied(person: PersonRow) {
    return updatePerson.mutateAsync({
      id: person.id,
      patch: { status: "replied", last_contacted_at: new Date().toISOString() },
    });
  }

  async function scheduleFollowUp(person: PersonRow, when: string) {
    const dueDate = new Date(when);
    const now = new Date();
    const sameOrEarlier = dueDate.getTime() <= now.getTime();
    return updatePerson.mutateAsync({
      id: person.id,
      patch: {
        next_follow_up_at: when,
        status: sameOrEarlier ? "follow_up_due" : "waiting",
      },
    });
  }

  async function markWaiting(person: PersonRow) {
    return updatePerson.mutateAsync({ id: person.id, patch: { status: "waiting" } });
  }

  async function markDormant(person: PersonRow) {
    return updatePerson.mutateAsync({ id: person.id, patch: { status: "dormant" } });
  }

  async function markClosed(person: PersonRow) {
    return updatePerson.mutateAsync({ id: person.id, patch: { status: "closed" } });
  }

  return {
    createPerson,
    updatePerson,
    deletePerson,
    restorePerson,
    setStatus,
    markContacted,
    markReplied,
    scheduleFollowUp,
    markWaiting,
    markDormant,
    markClosed,
  };
}

// Aliases per spec
export const useCreatePerson = () => usePersonMutations().createPerson;
export const useUpdatePerson = () => usePersonMutations().updatePerson;
export const useDeletePerson = () => usePersonMutations().deletePerson;
export const usePersonActions = usePersonMutations;
