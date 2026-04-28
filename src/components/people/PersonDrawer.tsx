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
  Users as UsersIcon,
  MessageCircle,
  Reply,
  CalendarClock,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  PersonRow,
  PersonInsert,
  PersonUpdate,
  PersonStatus,
  PersonPriority,
  RelationshipType,
  PERSON_STATUSES,
  PERSON_PRIORITIES,
  RELATIONSHIP_TYPES,
  PERSON_STATUS_LABEL,
  PERSON_PRIORITY_LABEL,
  RELATIONSHIP_LABEL,
} from "@/lib/people";
import {
  usePersonMutations,
  usePersonTasks,
} from "@/hooks/usePeople";
import { useJob } from "@/hooks/useJobs";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { TaskRow, TaskInsert, TaskPriority } from "@/lib/tasks";
import { FollowUpDialog } from "./FollowUpDialog";
import { JobLinkSelect } from "@/components/jobs/JobLinkSelect";
import { JobStatusBadge } from "@/components/jobs/JobBadges";

export type PersonDrawerMode =
  | { kind: "edit"; person: PersonRow }
  | { kind: "create"; defaults?: Partial<PersonInsert> }
  | null;

type Props = {
  mode: PersonDrawerMode;
  onClose: () => void;
};

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocal(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function PersonDrawer({ mode, onClose }: Props) {
  const m = usePersonMutations();
  const open = mode !== null;
  const isEdit = mode?.kind === "edit";
  const person = isEdit ? mode.person : null;

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("other");
  const [status, setStatus] = useState<PersonStatus>("to_contact");
  const [priority, setPriority] = useState<PersonPriority>("medium");
  const [strength, setStrength] = useState<string>("");
  const [lastContactedAt, setLastContactedAt] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [ask, setAsk] = useState("");
  const [notes, setNotes] = useState("");
  const [relatedJobId, setRelatedJobId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [taskMode, setTaskMode] = useState<
    | { kind: "edit"; task: TaskRow }
    | { kind: "create"; defaults?: Partial<TaskInsert> }
    | null
  >(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);
  const [followUpFor, setFollowUpFor] = useState<PersonRow | null>(null);

  const { data: linkedTasks = [], isLoading: tasksLoading } = usePersonTasks(
    person?.id ?? null
  );
  const { data: relatedJob } = useJob(relatedJobId);

  useEffect(() => {
    if (!mode) return;
    if (mode.kind === "edit") {
      const p = mode.person;
      setName(p.name);
      setCompany(p.company ?? "");
      setRoleTitle(p.role_title ?? "");
      setLinkedinUrl(p.linkedin_url ?? "");
      setEmail(p.email ?? "");
      setPhone(p.phone ?? "");
      setRelationshipType(p.relationship_type);
      setStatus(p.status);
      setPriority(p.priority);
      setStrength(p.relationship_strength?.toString() ?? "");
      setLastContactedAt(toLocal(p.last_contacted_at));
      setNextFollowUpAt(toLocal(p.next_follow_up_at));
      setAsk(p.ask ?? "");
      setNotes(p.notes ?? "");
      setRelatedJobId(p.related_job_id ?? null);
      setTimezone(p.timezone ?? "");
    } else {
      const d = mode.defaults ?? {};
      setName(d.name ?? "");
      setCompany(d.company ?? "");
      setRoleTitle(d.role_title ?? "");
      setLinkedinUrl("");
      setEmail("");
      setPhone("");
      setRelationshipType((d.relationship_type as RelationshipType) ?? "other");
      setStatus((d.status as PersonStatus) ?? "to_contact");
      setPriority((d.priority as PersonPriority) ?? "medium");
      setStrength("");
      setLastContactedAt("");
      setNextFollowUpAt("");
      setAsk("");
      setNotes("");
      setRelatedJobId(d.related_job_id ?? null);
      setTimezone("");
    }
  }, [mode]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const strengthNum = strength.trim() === "" ? null : Number(strength);
      const patch: PersonUpdate = {
        name: name.trim(),
        company: company.trim() || null,
        role_title: roleTitle.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        relationship_type: relationshipType,
        status,
        priority,
        relationship_strength: Number.isFinite(strengthNum as number)
          ? (strengthNum as number)
          : null,
        last_contacted_at: fromLocal(lastContactedAt),
        next_follow_up_at: fromLocal(nextFollowUpAt),
        ask: ask.trim() || null,
        notes: notes.trim() || null,
        related_job_id: relatedJobId,
        timezone: timezone.trim() || null,
      };
      if (isEdit && person) {
        await m.updatePerson.mutateAsync({ id: person.id, patch });
        toast.success("Person updated");
      } else {
        await m.createPerson.mutateAsync(patch as Omit<PersonInsert, "user_id">);
        toast.success("Person added");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!person) return;
    setDeleting(true);
    try {
      await m.deletePerson.mutateAsync(person.id);
      toast.success("Person deleted", {
        action: {
          label: "Undo",
          onClick: () => m.restorePerson.mutateAsync(person.id),
        },
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const quick = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
      toast.success(label);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const createLinkedTask = () => {
    if (!person) return;
    setTaskMode({
      kind: "create",
      defaults: {
        title: `Follow up with ${person.name}`,
        related_person_id: person.id,
        related_job_id: relatedJobId ?? null,
        category: "follow_up",
        priority: priority as unknown as TaskPriority,
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl bg-surface-1 border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              {isEdit ? "Edit person" : "New person"}
            </SheetTitle>
            {isEdit && person && (
              <SheetDescription>
                {person.name}
                {person.company ? ` · ${person.company}` : ""}
              </SheetDescription>
            )}
          </SheetHeader>

          {isEdit && person && (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button size="sm" variant="outline" onClick={() => quick(() => m.markContacted(person), "Marked contacted")}>
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> Contacted
              </Button>
              <Button size="sm" variant="outline" onClick={() => quick(() => m.markReplied(person), "Marked replied")}>
                <Reply className="h-3.5 w-3.5 mr-1" /> Replied
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFollowUpFor(person)}>
                <CalendarClock className="h-3.5 w-3.5 mr-1" /> Follow-up…
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" aria-label="More">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {PERSON_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                      Move to {PERSON_STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete person
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-company">Company</Label>
                <Input id="p-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-role">Role</Label>
                <Input id="p-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Recruiter" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Relationship</Label>
                <Select value={relationshipType} onValueChange={(v) => setRelationshipType(v as RelationshipType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{RELATIONSHIP_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="p-linkedin">LinkedIn URL</Label>
                <div className="flex gap-2">
                  <Input id="p-linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" />
                  {linkedinUrl && (
                    <Button type="button" variant="outline" size="icon" aria-label="Open"
                      onClick={() => window.open(linkedinUrl, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as PersonStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERSON_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{PERSON_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as PersonPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERSON_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{PERSON_PRIORITY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-strength">Relationship strength (1–5)</Label>
                <Input id="p-strength" type="number" min={1} max={5} step={1} value={strength}
                  onChange={(e) => setStrength(e.target.value)} placeholder="3" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-tz">Timezone</Label>
                <Input id="p-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-last">Last contacted</Label>
                <Input id="p-last" type="datetime-local" value={lastContactedAt} onChange={(e) => setLastContactedAt(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="p-next">Next follow-up</Label>
                <Input id="p-next" type="datetime-local" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Related job</Label>
                <JobLinkSelect value={relatedJobId} onChange={setRelatedJobId} />
                {relatedJob && (
                  <div className="rounded-md border border-border bg-surface-2 px-3 py-2 mt-1 flex items-center gap-2 text-xs">
                    <span className="font-semibold">{relatedJob.company}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{relatedJob.role_title}</span>
                    <JobStatusBadge status={relatedJob.status} className="ml-auto" />
                  </div>
                )}
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="p-ask">The ask</Label>
                <Input id="p-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Intro to hiring manager…" />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="p-notes">Notes</Label>
                <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Context, history, what they care about…" />
              </div>
            </div>

            {isEdit && person && (
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
              <Button variant="ghost" size="sm" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="ml-2">Delete</span>
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TaskDrawer mode={taskMode} onClose={() => setTaskMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
      <FollowUpDialog person={followUpFor} onClose={() => setFollowUpFor(null)} />
    </>
  );
}
