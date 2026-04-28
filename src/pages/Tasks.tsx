import { useMemo, useState } from "react";
import { ListTodo, Loader2, Search, X, Check, Plus } from "lucide-react";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import {
  TaskRow,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TaskStatus,
  TaskPriority,
  TaskCategory,
} from "@/lib/tasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { toast } from "sonner";

type Mode = { kind: "edit"; task: TaskRow } | { kind: "create" } | null;

export default function Tasks() {
  const { data: tasks = [], isLoading } = useTasks();
  const m = useTaskMutations();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [category, setCategory] = useState<TaskCategory | "all">("all");
  const [hideClosed, setHideClosed] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (hideClosed && (t.status === "done" || t.status === "killed")) return false;
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (category !== "all" && t.category !== category) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        if (!t.title.toLowerCase().includes(needle) && !(t.description ?? "").toLowerCase().includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, q, status, priority, category, hideClosed]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  };

  const toggleOne = (id: string, next: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (next) n.add(id); else n.delete(id);
      return n;
    });
  };

  const bulkDone = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const targets = tasks.filter((t) => ids.includes(t.id) && t.status !== "done" && t.status !== "killed");
    if (targets.length === 0) {
      toast.info("Nothing to mark done");
      setSelected(new Set());
      return;
    }
    try {
      await Promise.all(
        targets.map((t) =>
          m.update.mutateAsync({
            id: t.id,
            patch: { status: "done", completed_at: new Date().toISOString() },
          })
        )
      );
      toast.success(`Marked ${targets.length} done`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  return (
    <div className="container max-w-5xl py-6 sm:py-10 animate-fade-in space-y-5">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <ListTodo className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {tasks.length} task{tasks.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: "create" })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
          <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as any)}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={hideClosed ? "default" : "outline"}
          size="sm"
          onClick={() => setHideClosed((v) => !v)}
        >
          {hideClosed ? "Hide done/killed" : "Show all"}
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> selected
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={bulkDone}>
              <Check className="h-4 w-4 mr-1" /> Mark done
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: "create" })} />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <button onClick={toggleAll} className="hover:text-foreground">
              {allSelected ? "Clear selection" : "Select all"}
            </button>
          </div>
          <div className="space-y-1.5">
            {filtered.map((t) => (
              <TaskRowItem
                key={t.id}
                task={t}
                onOpen={(task) => setMode({ kind: "edit", task })}
                onBreakDown={setBreakDownTask}
                onKill={setKillTask}
                selectable
                selected={selected.has(t.id)}
                onSelectChange={(next) => toggleOne(t.id, next)}
              />
            ))}
          </div>
        </div>
      )}

      <TaskDrawer mode={mode} onClose={() => setMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
      <p className="text-sm text-muted-foreground">No tasks match your filters.</p>
      <Button onClick={onCreate} variant="outline" size="sm" className="mt-3">
        <Plus className="h-4 w-4 mr-1" /> Create task
      </Button>
    </div>
  );
}
