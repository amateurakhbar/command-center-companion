import { toast } from "sonner";
import { TaskRow, TaskUpdate, isOverdue } from "@/lib/tasks";
import { useTaskMutations } from "@/hooks/useTasks";

/**
 * Wrap an action with an Undo toast. The action returns the previous field
 * snapshot, which we restore if the user clicks Undo.
 */
export function useTaskActionToasts() {
  const m = useTaskMutations();

  function withUndo(label: string, taskId: string, prev: TaskUpdate) {
    toast.success(label, {
      action: {
        label: "Undo",
        onClick: () => m.restoreFields(taskId, prev),
      },
    });
  }

  return {
    async done(task: TaskRow) {
      try {
        const prev = await m.markDone(task);
        withUndo("Marked done", task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
    async reopen(task: TaskRow) {
      try {
        const prev = await m.reopen(task);
        withUndo("Reopened", task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
    async delay(task: TaskRow, hours: number, label = `Delayed ${hours}h`) {
      try {
        const prev = await m.delay(task, hours);
        withUndo(label, task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
    async kill(task: TaskRow, reason?: string) {
      try {
        const prev = await m.kill(task, reason);
        withUndo("Killed", task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
    async waiting(task: TaskRow) {
      try {
        const prev = await m.setWaiting(task);
        withUndo("Marked waiting", task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
    async reschedule(task: TaskRow, due_at: string | null, label = "Rescheduled") {
      try {
        const prev = await m.reschedule(task, due_at);
        withUndo(label, task.id, prev as TaskUpdate);
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
  };
}

export { isOverdue };
