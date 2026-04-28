import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PersonRow, PERSON_PRIORITY_LABEL } from "@/lib/people";
import { usePersonMutations } from "@/hooks/usePeople";
import { useTaskMutations } from "@/hooks/useTasks";
import { TaskPriority } from "@/lib/tasks";

type Props = {
  person: PersonRow | null;
  onClose: () => void;
};

function defaultFollowUpLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowUpDialog({ person, onClose }: Props) {
  const personMut = usePersonMutations();
  const taskMut = useTaskMutations();
  const [when, setWhen] = useState(defaultFollowUpLocal());
  const [createTask, setCreateTask] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (person) {
      setWhen(
        person.next_follow_up_at
          ? toLocal(person.next_follow_up_at)
          : defaultFollowUpLocal()
      );
      setCreateTask(true);
    }
  }, [person]);

  if (!person) return null;

  const submit = async () => {
    if (!when) {
      toast.error("Pick a date/time");
      return;
    }
    const iso = new Date(when).toISOString();
    setSaving(true);
    try {
      await personMut.scheduleFollowUp(person, iso);
      if (createTask) {
        await taskMut.create.mutateAsync({
          title: `Follow up with ${person.name}`,
          related_person_id: person.id,
          related_job_id: person.related_job_id ?? null,
          category: "follow_up",
          priority: person.priority as unknown as TaskPriority,
          due_at: iso,
          status: "to_do",
          source: "manual",
        });
      }
      toast.success("Follow-up scheduled");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface-1 border-border">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>
            {person.name}
            {person.company ? ` · ${person.company}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fu-when">When</Label>
            <Input
              id="fu-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              If today or earlier, status becomes <span className="text-warning">follow-up due</span>.
              Otherwise <span className="text-info">waiting</span>.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="fu-task"
              checked={createTask}
              onCheckedChange={(v) => setCreateTask(!!v)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="fu-task" className="font-normal cursor-pointer">
                Create follow-up task
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds a {PERSON_PRIORITY_LABEL[person.priority].toLowerCase()}-priority follow-up task linked to this person
                {person.related_job_id ? " and their job" : ""}.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
