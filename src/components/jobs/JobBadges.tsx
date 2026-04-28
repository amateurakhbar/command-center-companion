import { JobStatus, JobPriority, JOB_STATUS_LABEL, JOB_PRIORITY_LABEL } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<JobStatus, string> = {
  lead: "bg-surface-3 text-foreground/80 border-border",
  applied: "bg-info/15 text-info border-info/30",
  screening: "bg-primary/15 text-primary border-primary/30",
  interview: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_DOT: Record<JobPriority, string> = {
  high: "bg-pri-high",
  medium: "bg-pri-medium",
  low: "bg-pri-low",
};

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STATUS_CLASS[status],
        className
      )}
    >
      {JOB_STATUS_LABEL[status]}
    </span>
  );
}

export function JobPriorityDot({ priority, className }: { priority: JobPriority; className?: string }) {
  return (
    <span
      title={`${JOB_PRIORITY_LABEL[priority]} priority`}
      className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[priority], className)}
    />
  );
}
