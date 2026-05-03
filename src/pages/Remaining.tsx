import { useMemo, useState } from "react";
import { ListTodo, Loader2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskRow } from "@/lib/tasks";
import { groupRemaining } from "@/lib/remaining";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";

type Mode = { kind: "edit"; task: TaskRow } | null;

export default function Remaining() {
  const { data: tasks = [], isLoading } = useTasks();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);

  const g = useMemo(() => groupRemaining(tasks), [tasks]);
  const total = g.overdue.length + g.dueToday.length + g.upcoming.length + g.noDueDate.length + g.waiting.length;
  const high = [...g.overdue, ...g.dueToday, ...g.upcoming, ...g.noDueDate, ...g.waiting].filter((t) => t.priority === "high").length;

  const sections: { title: string; tone: string; items: TaskRow[] }[] = [
    { title: "Overdue", tone: "text-destructive", items: g.overdue },
    { title: "Due today", tone: "text-warning", items: g.dueToday },
    { title: "Upcoming", tone: "text-primary", items: g.upcoming },
    { title: "No due date", tone: "text-muted-foreground", items: g.noDueDate },
    { title: "Waiting", tone: "text-info", items: g.waiting },
  ];

  return (
    <div className="container max-w-3xl py-6 sm:py-10 animate-fade-in space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <ListTodo className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Remaining</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} active · {g.overdue.length} overdue · {g.dueToday.length} today · {g.upcoming.length} upcoming · {g.noDueDate.length} no date · {g.waiting.length} waiting · {high} high priority
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">Nothing remaining. You're clear.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) =>
            s.items.length === 0 ? null : (
              <section key={s.title} className="space-y-2">
                <h3 className={`text-xs font-mono uppercase tracking-widest ${s.tone}`}>
                  {s.title} <span className="text-muted-foreground">· {s.items.length}</span>
                </h3>
                <div className="space-y-1.5">
                  {s.items.map((t) => (
                    <TaskRowItem
                      key={t.id}
                      task={t}
                      onOpen={(task) => setMode({ kind: "edit", task })}
                      onBreakDown={setBreakDownTask}
                      onKill={setKillTask}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <TaskDrawer mode={mode} onClose={() => setMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
    </div>
  );
}
