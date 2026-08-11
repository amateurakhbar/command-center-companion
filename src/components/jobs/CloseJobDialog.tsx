import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { JobRow } from "@/lib/jobs";
import { useJobMutations } from "@/hooks/useJobs";
import { toast } from "sonner";

export type CloseKind = "rejected" | "withdrawn";

type Props = {
  job: JobRow | null;
  kind: CloseKind | null;
  onClose: () => void;
};

export function CloseJobDialog({ job, kind, onClose }: Props) {
  const m = useJobMutations();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job) setReason(job.closed_reason ?? "");
  }, [job, kind]);

  if (!job || !kind) return null;

  const verb = kind === "rejected" ? "Mark rejected" : "Mark withdrawn";

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setSaving(true);
    try {
      if (kind === "rejected") await m.markRejected(job, reason.trim());
      else await m.markWithdrawn(job, reason.trim());
      toast.success(verb);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!job && !!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface-1 border-border">
        <DialogHeader>
          <DialogTitle>{verb}</DialogTitle>
          <DialogDescription>
            {job.company} · {job.role_title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              kind === "rejected"
                ? "e.g. Rejected after screening: not enough domain experience."
                : "e.g. Withdrew: comp gap, accepted other role."
            }
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
