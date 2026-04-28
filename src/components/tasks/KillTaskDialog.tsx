import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TaskRow } from "@/lib/tasks";
import { useTaskMutations } from "@/hooks/useTasks";
import { toast } from "sonner";
import { Loader2, Skull } from "lucide-react";

type Props = {
  task: TaskRow | null;
  onClose: () => void;
  onKilled?: () => void;
};

export function KillTaskDialog({ task, onClose, onKilled }: Props) {
  const m = useTaskMutations();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) setReason("");
  }, [task]);

  const submit = async () => {
    if (!task) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Reason is required to kill a task");
      return;
    }
    setSubmitting(true);
    try {
      const prev = await m.kill(task, trimmed);
      toast.success("Killed", {
        action: {
          label: "Undo",
          onClick: () => m.restoreFields(task.id, prev as any),
        },
      });
      onKilled?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface-1">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Skull className="h-4 w-4 text-destructive" /> Kill task
          </DialogTitle>
          <DialogDescription>
            Why is "{task?.title}" being killed? A short reason keeps your closeout honest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="kill-reason">Reason</Label>
          <Textarea
            id="kill-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="No longer relevant / out of scope / wrong priority…"
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kill task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
