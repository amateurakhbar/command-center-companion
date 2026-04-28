import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Trash2,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ArrowDownCircle,
  MoreVertical,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import {
  JobRow,
  JobInsert,
  JobUpdate,
  JOB_STATUSES,
  JOB_PRIORITIES,
  JOB_STATUS_LABEL,
  JOB_PRIORITY_LABEL,
  JobStatus,
  JobPriority,
} from "@/lib/jobs";
import { useJobMutations, useJobTasks } from "@/hooks/useJobs";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { TaskRow, TaskInsert, TaskPriority } from "@/lib/tasks";
import { CloseJobDialog, CloseKind } from "./CloseJobDialog";

export type JobDrawerMode = { kind: "edit"; job: JobRow } | { kind: "create" } | null;

type Props = {
  mode: JobDrawerMode;
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

function priorityToTaskPriority(p: JobPriority): TaskPriority {
  // job priority enum and task priority enum share the same values
  return p as unknown as TaskPriority;
}

export function JobDrawer({ mode, onClose }: Props) {
  const m = useJobMutations();
  const open = mode !== null;
  const isEdit = mode?.kind === "edit";
  const job = isEdit ? mode.job : null;

  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<JobStatus>("lead");
  const [priority, setPriority] = useState<JobPriority>("medium");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [closedAt, setClosedAt] = useState("");
  const [closedReason, setClosedReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [taskMode, setTaskMode] = useState<
    | { kind: "edit"; task: TaskRow }
    | { kind: "create"; defaults?: Partial<TaskInsert> }
    | null
  >(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);
  const [closeKind, setCloseKind] = useState<CloseKind | null>(null);

  const { data: linkedTasks = [], isLoading: tasksLoading } = useJobTasks(job?.id ?? null);

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "edit") {
      const j = mode.job;
      setCompany(j.company);
      setRoleTitle(j.role_title);
      setLocation(j.location ?? "");
      setJobUrl(j.job_url ?? "");
      setSource(j.source ?? "");
      setStatus(j.status);
      setPriority(j.priority);
      setNextAction(j.next_action ?? "");
      setNextActionAt(toLocalInput(j.next_action_at));
      setAppliedAt(toLocalInput(j.applied_at));
      setClosedAt(toLocalInput(j.closed_at));
      setClosedReason(j.closed_reason ?? "");
      setNotes(j.notes ?? "");
    } else {
      setCompany("");
      setRoleTitle("");
      setLocation("");
      setJobUrl("");
      setSource("");
      setStatus("lead");
      setPriority("medium");
      setNextAction("");
      setNextActionAt("");
      setAppliedAt("");
      setClosedAt("");
      setClosedReason("");
      setNotes("");
    }
  }, [mode]);

  const save = async () => {
    if (!company.trim() || !roleTitle.trim()) {
      toast.error("Company and role are required");
      return;
    }
    setSaving(true);
    try {
      if (mode?.kind === "edit") {
        const patch: JobUpdate = {
          company: company.trim(),
          role_title: roleTitle.trim(),
          location: location.trim() || null,
          job_url: jobUrl.trim() || null,
          source: source.trim() || null,
          status,
          priority,
          next_action: nextAction.trim() || null,
          next_action_at: fromLocalInput(nextActionAt),
          applied_at: fromLocalInput(appliedAt),
          closed_at: fromLocalInput(closedAt),
          closed_reason: closedReason.trim() || null,
          notes: notes.trim() || null,
        };
        await m.updateJob.mutateAsync({ id: mode.job.id, patch });
        toast.success("Job updated");
      } else {
        const insert: Omit<JobInsert, "user_id"> = {
          company: company.trim(),
          role_title: roleTitle.trim(),
          location: location.trim() || null,
          job_url: jobUrl.trim() || null,
          source: source.trim() || null,
          status,
          priority,
          next_action: nextAction.trim() || null,
          next_action_at: fromLocalInput(nextActionAt),
          applied_at: fromLocalInput(appliedAt),
          closed_at: fromLocalInput(closedAt),
          closed_reason: closedReason.trim() || null,
          notes: notes.trim() || null,
        };
        await m.createJob.mutateAsync(insert);
        toast.success("Job created");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!job) return;
    setDeleting(true);
    try {
      await m.deleteJob.mutateAsync(job.id);
      toast.success("Job deleted", {
        action: {
          label: "Undo",
          onClick: () => m.restoreJob.mutateAsync(job.id),
        },
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const markAppliedNow = async () => {
    if (!job) return;
    try {
      await m.markApplied(job);
      toast.success("Marked applied");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const createLinkedTask = () => {
    if (!job) return;
    const title =
      job.next_action?.trim() ||
      `Next step for ${job.company} — ${job.role_title}`;
    setTaskMode({
      kind: "create",
      defaults: {
        title,
        related_job_id: job.id,
        category: "job_application",
        priority: priorityToTaskPriority(job.priority),
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl bg-surface-1 border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {isEdit ? "Edit job" : "New job"}
            </SheetTitle>
            {isEdit && job && (
              <SheetDescription>
                {job.company} · {job.role_title}
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Quick actions for edit */}
          {isEdit && job && (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button size="sm" variant="outline" onClick={markAppliedNow}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark applied
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCloseKind("rejected")}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Rejected…
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCloseKind("withdrawn")}>
                <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Withdraw…
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" aria-label="More">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {JOB_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                      Move to {JOB_STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={remove}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete job
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-company">Company</Label>
                <Input
                  id="j-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                  autoFocus
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-role">Role</Label>
                <Input
                  id="j-role"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="VP Engineering"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-loc">Location</Label>
                <Input
                  id="j-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="London / Remote"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-source">Source</Label>
                <Input
                  id="j-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="LinkedIn, referral, …"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="j-url">Job URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="j-url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://…"
                  />
                  {jobUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(jobUrl, "_blank", "noopener,noreferrer")}
                      aria-label="Open URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {JOB_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {JOB_PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="j-next">Next action</Label>
                <Input
                  id="j-next"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Send tailored CV to recruiter"
                />
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-next-at">Next action at</Label>
                <Input
                  id="j-next-at"
                  type="datetime-local"
                  value={nextActionAt}
                  onChange={(e) => setNextActionAt(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-applied">Applied at</Label>
                <Input
                  id="j-applied"
                  type="datetime-local"
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                />
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-closed">Closed at</Label>
                <Input
                  id="j-closed"
                  type="datetime-local"
                  value={closedAt}
                  onChange={(e) => setClosedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="j-creason">Closed reason</Label>
                <Input
                  id="j-creason"
                  value={closedReason}
                  onChange={(e) => setClosedReason(e.target.value)}
                  placeholder="e.g. comp gap"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="j-notes">Notes</Label>
                <Textarea
                  id="j-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Recruiter contacts, scorecard, JD highlights…"
                />
              </div>
            </div>

            {/* Linked tasks */}
            {isEdit && job && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label>Linked tasks</Label>
                  <Button size="sm" variant="outline" onClick={createLinkedTask}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create linked task
                  </Button>
                </div>
                {tasksLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : linkedTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-surface-1/40 p-4 text-center text-xs text-muted-foreground">
                    No linked tasks yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {linkedTasks.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onOpen={(task) => setTaskMode({ kind: "edit", task })}
                        onBreakDown={setBreakDownTask}
                        onKill={setKillTask}
                        showLinkedIndicators={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-between sm:justify-between gap-2">
            {isEdit ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={deleting}
                className="text-destructive hover:text-destructive"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="ml-2">Delete</span>
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Nested task editing dialogs */}
      <TaskDrawer mode={taskMode} onClose={() => setTaskMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
      <CloseJobDialog
        job={isEdit ? job : null}
        kind={closeKind}
        onClose={() => setCloseKind(null)}
      />
    </>
  );
}
