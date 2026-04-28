import { MapPin, ArrowRight, Calendar, ExternalLink } from "lucide-react";
import { JobRow, relativeDate } from "@/lib/jobs";
import { JobStatusBadge, JobPriorityDot } from "./JobBadges";
import { cn } from "@/lib/utils";

type Props = {
  job: JobRow;
  onOpen: (job: JobRow) => void;
};

export function JobRowItem({ job, onOpen }: Props) {
  const isClosed = job.status === "rejected" || job.status === "withdrawn";

  return (
    <button
      onClick={() => onOpen(job)}
      className={cn(
        "w-full text-left group flex items-start gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5 transition-colors hover:bg-surface-2",
        isClosed && "opacity-60"
      )}
    >
      <JobPriorityDot priority={job.priority} className="mt-2 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{job.company}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-foreground/85 truncate">{job.role_title}</span>
          <JobStatusBadge status={job.status} />
        </div>

        <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {job.location}
            </span>
          )}
          {job.next_action && (
            <span className="inline-flex items-center gap-1 text-foreground/80">
              <ArrowRight className="h-3 w-3" />
              <span className="truncate max-w-[18rem]">{job.next_action}</span>
              {job.next_action_at && (
                <span className="text-muted-foreground">· {relativeDate(job.next_action_at)}</span>
              )}
            </span>
          )}
          {job.applied_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Applied {relativeDate(job.applied_at)}
            </span>
          )}
          {job.job_url && (
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> link
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
