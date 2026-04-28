import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TaskRow } from "@/lib/tasks";
import { useTaskMutations } from "@/hooks/useTasks";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  task: TaskRow | null;
  onClose: () => void;
};

export function BreakDownDialog({ task, onClose }: Props) {
  const m = useTaskMutations();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!task) return;
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Add at least one subtask");
      return;
    }
    setSubmitting(true);
    try {
      await m.breakDown(task, lines);
      toast.success(`Created ${lines.length} subtask${lines.length === 1 ? "" : "s"}`);
      setText("");
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
          <DialogTitle>Break down task</DialogTitle>
          <DialogDescription>
            One subtask per line. They inherit priority and category from "{task?.title}".
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"Draft outline\nWrite first paragraph\nReview and send"}
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create subtasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
