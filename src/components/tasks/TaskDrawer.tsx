import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  TaskRow,
  TaskInsert,
  TaskUpdate,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "@/lib/tasks";
import { useTaskMutations } from "@/hooks/useTasks";

type Mode = { kind: "edit"; task: TaskRow } | { kind: "create"; defaults?: Partial<TaskInsert> } | null;

type Props = {
  mode: Mode;
  onClose: () => void;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function TaskDrawer({ mode, onClose }: Props) {
  const m = useTaskMutations();
  const open = mode !== null;
  const isEdit = mode?.kind === "edit";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskRow["status"]>("to_do");
  const [priority, setPriority] = useState<TaskRow["priority"]>("medium");
  const [category, setCategory] = useState<TaskRow["category"]>("admin");
  const [dueLocal, setDueLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "edit") {
      const t = mode.task;
      setTitle(t.title);
      setDescription(t.description ?? "");
      setStatus(t.status);
      setPriority(t.priority);
      setCategory(t.category);
      setDueLocal(toLocalInput(t.due_at));
    } else {
      setTitle(mode.defaults?.title ?? "");
      setDescription("");
      setStatus(mode.defaults?.status ?? "to_do");
      setPriority(mode.defaults?.priority ?? "medium");
      setCategory(mode.defaults?.category ?? "admin");
      setDueLocal(toLocalInput(mode.defaults?.due_at as string | null | undefined));
    }
  }, [mode]);

  const linkedJob = isEdit && (mode as any).task.related_job_id;
  const linkedPerson = isEdit && (mode as any).task.related_person_id;

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    // Block silent kill via the drawer — require a reason. Reuse the dedicated dialog
    // by closing here and surfacing an error; the user kills via the menu's Kill… option.
    if (mode?.kind === "edit" && status === "killed" && mode.task.status !== "killed" && !mode.task.killed_reason) {
      toast.error("Use the Kill… action to set a reason");
      return;
    }
    setSaving(true);
    try {
      if (mode?.kind === "edit") {
        const patch: TaskUpdate = {
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          category,
          due_at: fromLocalInput(dueLocal),
          completed_at: status === "done" ? mode.task.completed_at ?? new Date().toISOString() : null,
          killed_at: status === "killed" ? mode.task.killed_at ?? new Date().toISOString() : null,
        };
        await m.update.mutateAsync({ id: mode.task.id, patch });
        toast.success("Task updated");
      } else {
        await m.create.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          category,
          due_at: fromLocalInput(dueLocal),
        });
        toast.success("Task created");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (mode?.kind !== "edit") return;
    setDeleting(true);
    const id = mode.task.id;
    try {
      await m.softDelete.mutateAsync(id);
      toast.success("Task deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            await m.update.mutateAsync({ id, patch: { deleted_at: null } });
          },
        },
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg bg-surface-1 border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit task" : "New task"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to happen?"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">Notes</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Context, blockers, links…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskRow["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskRow["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskRow["category"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="t-due">Due</Label>
              <Input
                id="t-due"
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
              />
            </div>
          </div>

          {(linkedJob || linkedPerson) && (
            <div className="rounded-md border border-border bg-surface-2 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Linked</div>
              {linkedJob && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /> Job linked
                </div>
              )}
              {linkedPerson && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Person linked
                </div>
              )}
              <div className="text-[10px] text-muted-foreground/70">Linking UI ships in Phase 2.</div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-between sm:justify-between gap-2">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-2">Delete</span>
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
