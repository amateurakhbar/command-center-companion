import {
  PersonStatus,
  PersonPriority,
  RelationshipType,
  PERSON_STATUS_LABEL,
  PERSON_PRIORITY_LABEL,
  RELATIONSHIP_LABEL,
} from "@/lib/people";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<PersonStatus, string> = {
  to_contact: "bg-surface-3 text-foreground/80 border-border",
  contacted: "bg-info/15 text-info border-info/30",
  replied: "bg-primary/15 text-primary border-primary/30",
  meeting_booked: "bg-success/15 text-success border-success/30",
  follow_up_due: "bg-warning/15 text-warning border-warning/30",
  waiting: "bg-info/10 text-info border-info/20",
  dormant: "bg-muted text-muted-foreground border-border",
  closed: "bg-destructive/10 text-destructive border-destructive/30",
};

const PRIORITY_DOT: Record<PersonPriority, string> = {
  high: "bg-pri-high",
  medium: "bg-pri-medium",
  low: "bg-pri-low",
};

export function PersonStatusBadge({
  status,
  className,
}: {
  status: PersonStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        STATUS_CLASS[status],
        className
      )}
    >
      {PERSON_STATUS_LABEL[status]}
    </span>
  );
}

export function PersonPriorityDot({
  priority,
  className,
}: {
  priority: PersonPriority;
  className?: string;
}) {
  return (
    <span
      title={`${PERSON_PRIORITY_LABEL[priority]} priority`}
      className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[priority], className)}
    />
  );
}

export function RelationshipBadge({
  type,
  className,
}: {
  type: RelationshipType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {RELATIONSHIP_LABEL[type]}
    </span>
  );
}

export function StrengthMeter({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5" title={`Strength ${v}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < v ? "bg-primary" : "bg-surface-3"
          )}
        />
      ))}
    </span>
  );
}
