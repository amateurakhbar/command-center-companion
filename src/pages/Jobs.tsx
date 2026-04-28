import { useMemo, useState } from "react";
import { Briefcase, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import {
  JobRow,
  JobStatus,
  JobPriority,
  JOB_STATUSES,
  JOB_PRIORITIES,
  JOB_STATUS_LABEL,
  JOB_PRIORITY_LABEL,
  JOB_STATUS_ORDER,
} from "@/lib/jobs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobRowItem } from "@/components/jobs/JobRowItem";
import { JobDrawer, JobDrawerMode } from "@/components/jobs/JobDrawer";
import { JobsTrashSheet } from "@/components/jobs/JobsTrashSheet";

export default function Jobs() {
  const { data: jobs = [], isLoading } = useJobs();
  const [mode, setMode] = useState<JobDrawerMode>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [priority, setPriority] = useState<JobPriority | "all">("all");
  const [grouped, setGrouped] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (status !== "all" && j.status !== status) return false;
      if (priority !== "all" && j.priority !== priority) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        if (
          !j.company.toLowerCase().includes(needle) &&
          !j.role_title.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [jobs, q, status, priority]);

  const groups = useMemo(() => {
    const map = new Map<JobStatus, JobRow[]>();
    for (const s of JOB_STATUS_ORDER) map.set(s, []);
    for (const j of filtered) map.get(j.status)?.push(j);
    return JOB_STATUS_ORDER.map((s) => ({ status: s, jobs: map.get(s) ?? [] }));
  }, [filtered]);

  return (
    <div className="container max-w-5xl py-6 sm:py-10 animate-fade-in space-y-5">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Job Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {jobs.length} job{jobs.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: "create" })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add job
        </Button>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as JobStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority | "all")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {JOB_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {JOB_PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={grouped ? "default" : "outline"}
          size="sm"
          onClick={() => setGrouped((g) => !g)}
        >
          {grouped ? "Flat list" : "Group by status"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTrashOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Deleted
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: "create" })} />
      ) : grouped ? (
        <div className="space-y-5">
          {groups.map(({ status: s, jobs: js }) =>
            js.length === 0 ? null : (
              <section key={s} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {JOB_STATUS_LABEL[s]}
                  </h3>
                  <span className="text-xs text-muted-foreground">· {js.length}</span>
                </div>
                <div className="space-y-1.5">
                  {js.map((j) => (
                    <JobRowItem
                      key={j.id}
                      job={j}
                      onOpen={(job) => setMode({ kind: "edit", job })}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((j) => (
            <JobRowItem
              key={j.id}
              job={j}
              onOpen={(job) => setMode({ kind: "edit", job })}
            />
          ))}
        </div>
      )}

      <JobDrawer mode={mode} onClose={() => setMode(null)} />
      <JobsTrashSheet open={trashOpen} onOpenChange={setTrashOpen} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
      <p className="text-sm text-muted-foreground">No jobs match your filters.</p>
      <Button onClick={onCreate} variant="outline" size="sm" className="mt-3">
        <Plus className="h-4 w-4 mr-1" /> Add job
      </Button>
    </div>
  );
}
