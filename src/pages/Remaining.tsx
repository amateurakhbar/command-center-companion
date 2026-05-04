import { useMemo, useState } from "react";
import { ListTodo, Loader2, X } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import {
  TaskRow,
  TaskPriority,
  TaskCategory,
  TaskStatus,
  TASK_PRIORITIES,
  TASK_CATEGORIES,
  PRIORITY_LABEL,
  CATEGORY_LABEL,
  STATUS_LABEL,
} from "@/lib/tasks";
import { groupRemaining } from "@/lib/remaining";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = { kind: "edit"; task: TaskRow } | null;

type TaskSource = TaskRow["source"];
const SOURCES: TaskSource[] = ["manual", "telegram", "ai_parser", "recurring"];
const SOURCE_LABEL: Record<TaskSource, string> = {
  manual: "Manual",
  telegram: "Telegram",
  ai_parser: "AI",
  recurring: "Recurring",
};
// Only "active" statuses can be remaining (done/killed are excluded by isRemaining).
const ACTIVE_STATUSES: TaskStatus[] = ["to_do", "in_progress", "waiting"];

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-surface-1 text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function Remaining() {
  const { data: tasks = [], isLoading } = useTasks();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriority>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<TaskCategory>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<Set<TaskSource>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(new Set());

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clearAll = () => {
    setPriorityFilter(new Set());
    setCategoryFilter(new Set());
    setSourceFilter(new Set());
    setStatusFilter(new Set());
  };

  const hasFilters =
    priorityFilter.size + categoryFilter.size + sourceFilter.size + statusFilter.size > 0;

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter.size && !priorityFilter.has(t.priority)) return false;
      if (categoryFilter.size && !categoryFilter.has(t.category)) return false;
      if (sourceFilter.size && !sourceFilter.has(t.source)) return false;
      if (statusFilter.size && !statusFilter.has(t.status)) return false;
      return true;
    });
  }, [tasks, priorityFilter, categoryFilter, sourceFilter, statusFilter]);

  const g = useMemo(() => groupRemaining(filteredTasks), [filteredTasks]);
  const total =
    g.overdue.length + g.dueToday.length + g.upcoming.length + g.noDueDate.length + g.waiting.length;
  const high = [...g.overdue, ...g.dueToday, ...g.upcoming, ...g.noDueDate, ...g.waiting].filter(
    (t) => t.priority === "high",
  ).length;

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
            {total} active · {g.overdue.length} overdue · {g.dueToday.length} today ·{" "}
            {g.upcoming.length} upcoming · {g.noDueDate.length} no date · {g.waiting.length} waiting
            · {high} high priority
          </p>
        </div>
      </header>

      <section className="space-y-2.5 rounded-xl border border-border bg-surface-1/40 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Filters
          </h3>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center mr-1">
              Priority
            </span>
            {TASK_PRIORITIES.map((p) => (
              <FilterPill
                key={p}
                active={priorityFilter.has(p)}
                onClick={() => toggle(setPriorityFilter, p)}
              >
                {PRIORITY_LABEL[p]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center mr-1">
              Status
            </span>
            {ACTIVE_STATUSES.map((s) => (
              <FilterPill
                key={s}
                active={statusFilter.has(s)}
                onClick={() => toggle(setStatusFilter, s)}
              >
                {STATUS_LABEL[s]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center mr-1">
              Source
            </span>
            {SOURCES.map((s) => (
              <FilterPill
                key={s}
                active={sourceFilter.has(s)}
                onClick={() => toggle(setSourceFilter, s)}
              >
                {SOURCE_LABEL[s]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center mr-1">
              Category
            </span>
            {TASK_CATEGORIES.map((c) => (
              <FilterPill
                key={c}
                active={categoryFilter.has(c)}
                onClick={() => toggle(setCategoryFilter, c)}
              >
                {CATEGORY_LABEL[c]}
              </FilterPill>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "No tasks match the current filters." : "Nothing remaining. You're clear."}
          </p>
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
