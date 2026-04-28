import { TaskCategory, TaskPriority, TaskStatus, CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<TaskStatus, string> = {
  to_do: "bg-surface-3 text-foreground/80 border-border",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  waiting: "bg-info/15 text-info border-info/30",
  done: "bg-success/15 text-success border-success/30",
  killed: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-pri-high",
  medium: "bg-pri-medium",
  low: "bg-pri-low",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STATUS_CLASS[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityDot({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      title={`${PRIORITY_LABEL[priority]} priority`}
      className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[priority], className)}
    />
  );
}

export function CategoryBadge({ category, className }: { category: TaskCategory; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
