import { useMemo, useState } from "react";
import { Sun, Loader2 } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskRow, isDueToday, isOverdue } from "@/lib/tasks";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { QuickAdd } from "@/components/tasks/QuickAdd";

type Mode = { kind: "edit"; task: TaskRow } | { kind: "create" } | null;

const PRIORITY_RANK: Record<TaskRow["priority"], number> = { high: 0, medium: 1, low: 2 };

function sortForToday(a: TaskRow, b: TaskRow) {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  const ad = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bd = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

export default function Today() {
  const { data: tasks = [], isLoading } = useTasks();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);

  const sections = useMemo(() => {
    const live = tasks.filter((t) => !t.deleted_at);

    // Do Now: in_progress, not done/killed/waiting
    const doNow = live
      .filter((t) => t.status === "in_progress")
      .sort(sortForToday);
    const doNowIds = new Set(doNow.map((t) => t.id));

    // Overdue: status NOT IN (done, killed, waiting) AND due_at < now
    const overdue = live
      .filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "killed" &&
          t.status !== "waiting" &&
          isOverdue(t.due_at)
      )
      .filter((t) => !doNowIds.has(t.id))
      .sort(sortForToday);

    // Due Today: not done/killed/waiting, due today, not in Do Now (and not overdue)
    const overdueIds = new Set(overdue.map((t) => t.id));
    const dueToday = live
      .filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "killed" &&
          t.status !== "waiting" &&
          isDueToday(t.due_at) &&
          !isOverdue(t.due_at) &&
          !doNowIds.has(t.id) &&
          !overdueIds.has(t.id)
      )
      .sort(sortForToday);

    // Waiting
    const waiting = live.filter((t) => t.status === "waiting").sort(sortForToday);

    return { doNow, dueToday, overdue, waiting };
  }, [tasks]);

  const totalLive = sections.doNow.length + sections.dueToday.length + sections.overdue.length;

  return (
    <div className="container max-w-3xl py-6 sm:py-10 animate-fade-in space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sun className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLive === 0
              ? "Nothing live. Capture something to do."
              : `${totalLive} live task${totalLive === 1 ? "" : "s"}.`}
          </p>
        </div>
      </header>

      <QuickAdd />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Do now"
            hint="In progress"
            tasks={sections.doNow}
            tone="primary"
            onOpen={(t) => setMode({ kind: "edit", task: t })}
            onBreakDown={setBreakDownTask}
            onKill={setKillTask}
          />
          <Section
            title="Overdue"
            hint="Past due"
            tasks={sections.overdue}
            tone="destructive"
            onOpen={(t) => setMode({ kind: "edit", task: t })}
            onBreakDown={setBreakDownTask}
            onKill={setKillTask}
          />
          <Section
            title="Due today"
            hint="Closes today"
            tasks={sections.dueToday}
            tone="warning"
            onOpen={(t) => setMode({ kind: "edit", task: t })}
            onBreakDown={setBreakDownTask}
            onKill={setKillTask}
          />
          <Section
            title="Waiting"
            hint="Blocked on someone else"
            tasks={sections.waiting}
            tone="info"
            onOpen={(t) => setMode({ kind: "edit", task: t })}
            onBreakDown={setBreakDownTask}
            onKill={setKillTask}
          />
        </div>
      )}

      <TaskDrawer mode={mode} onClose={() => setMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
    </div>
  );
}

const TONE_CLASS = {
  primary: "text-primary",
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
} as const;

function Section({
  title,
  hint,
  tasks,
  tone,
  onOpen,
  onBreakDown,
  onKill,
}: {
  title: string;
  hint: string;
  tasks: TaskRow[];
  tone: keyof typeof TONE_CLASS;
  onOpen: (t: TaskRow) => void;
  onBreakDown: (t: TaskRow) => void;
  onKill: (t: TaskRow) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className={`text-xs font-mono uppercase tracking-widest ${TONE_CLASS[tone]}`}>
          {title} <span className="text-muted-foreground">· {tasks.length}</span>
        </h3>
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">{hint}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <TaskRowItem key={t.id} task={t} onOpen={onOpen} onBreakDown={onBreakDown} onKill={onKill} />
        ))}
      </div>
    </section>
  );
}
