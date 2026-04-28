import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskRow, isOverdue } from "@/lib/tasks";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { Button } from "@/components/ui/button";
import { useTaskActionToasts } from "@/hooks/useTaskActions";

type Mode = { kind: "edit"; task: TaskRow } | null;

const PRIORITY_RANK: Record<TaskRow["priority"], number> = { high: 0, medium: 1, low: 2 };

export default function Overdue() {
  const { data: tasks = [], isLoading } = useTasks();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);
  const actions = useTaskActionToasts();

  const overdue = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          !t.deleted_at &&
          t.status !== "done" &&
          t.status !== "killed" &&
          t.status !== "waiting" &&
          isOverdue(t.due_at)
      )
      .sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (p !== 0) return p;
        return new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime();
      });
  }, [tasks]);

  const rescheduleAllToToday = async () => {
    const end = new Date();
    end.setHours(23, 59, 0, 0);
    const iso = end.toISOString();
    for (const t of overdue) {
      // sequential to keep undo-friendly toasts manageable; small lists expected
      await actions.reschedule(t, iso, "Moved to today");
    }
  };

  return (
    <div className="container max-w-3xl py-6 sm:py-10 animate-fade-in space-y-5">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Overdue</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {overdue.length === 0
              ? "Nothing overdue. Stay sharp."
              : `${overdue.length} task${overdue.length === 1 ? "" : "s"} past due.`}
          </p>
        </div>
        {overdue.length > 0 && (
          <Button variant="outline" size="sm" onClick={rescheduleAllToToday}>
            Move all to today
          </Button>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : overdue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">All clear. No overdue tasks.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {overdue.map((t) => (
            <TaskRowItem
              key={t.id}
              task={t}
              onOpen={(task) => setMode({ kind: "edit", task })}
              onBreakDown={setBreakDownTask}
              onKill={setKillTask}
            />
          ))}
        </div>
      )}

      <TaskDrawer mode={mode} onClose={() => setMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
    </div>
  );
}
