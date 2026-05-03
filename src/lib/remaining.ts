import { TaskRow, isOverdue, isDueToday } from "@/lib/tasks";

const PRIORITY_RANK: Record<TaskRow["priority"], number> = { high: 0, medium: 1, low: 2 };

export type RemainingGroups = {
  overdue: TaskRow[];
  dueToday: TaskRow[];
  upcoming: TaskRow[];
  noDueDate: TaskRow[];
  waiting: TaskRow[];
};

export function isRemaining(t: TaskRow): boolean {
  return !t.deleted_at && t.status !== "done" && t.status !== "killed";
}

export function groupRemaining(tasks: TaskRow[]): RemainingGroups {
  const live = tasks.filter(isRemaining);

  const waiting = live
    .filter((t) => t.status === "waiting")
    .sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const active = live.filter((t) => t.status !== "waiting");

  const overdue = active
    .filter((t) => isOverdue(t.due_at))
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      return new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime();
    });

  const dueToday = active
    .filter((t) => !isOverdue(t.due_at) && isDueToday(t.due_at))
    .sort((a, b) => {
      const ad = new Date(a.due_at!).getTime();
      const bd = new Date(b.due_at!).getTime();
      if (ad !== bd) return ad - bd;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  const upcoming = active
    .filter((t) => t.due_at && !isOverdue(t.due_at) && !isDueToday(t.due_at))
    .sort((a, b) => {
      const ad = new Date(a.due_at!).getTime();
      const bd = new Date(b.due_at!).getTime();
      if (ad !== bd) return ad - bd;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  const noDueDate = active
    .filter((t) => !t.due_at)
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  return { overdue, dueToday, upcoming, noDueDate, waiting };
}
