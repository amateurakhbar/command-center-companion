import { useMemo, useState } from "react";
import { Users, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { usePeople, usePersonMutations } from "@/hooks/usePeople";
import {
  PersonRow,
  PersonStatus,
  PersonPriority,
  RelationshipType,
  PERSON_STATUSES,
  PERSON_PRIORITIES,
  RELATIONSHIP_TYPES,
  PERSON_STATUS_LABEL,
  PERSON_PRIORITY_LABEL,
  RELATIONSHIP_LABEL,
  PERSON_STATUS_ORDER,
  PersonSort,
  PERSON_SORT_LABEL,
} from "@/lib/people";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonRowItem } from "@/components/people/PersonRowItem";
import { PersonDrawer, PersonDrawerMode } from "@/components/people/PersonDrawer";
import { PeopleTrashSheet } from "@/components/people/PeopleTrashSheet";
import { FollowUpDialog } from "@/components/people/FollowUpDialog";
import { toast } from "sonner";

const PRIORITY_RANK: Record<PersonPriority, number> = { high: 0, medium: 1, low: 2 };

export default function People() {
  const { data: people = [], isLoading } = usePeople();
  const m = usePersonMutations();

  const [mode, setMode] = useState<PersonDrawerMode>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [followUpFor, setFollowUpFor] = useState<PersonRow | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState<RelationshipType | "all">("all");
  const [status, setStatus] = useState<PersonStatus | "all">("all");
  const [priority, setPriority] = useState<PersonPriority | "all">("all");
  const [sortBy, setSortBy] = useState<PersonSort>("next_follow_up_at");
  const [grouped, setGrouped] = useState(false);

  const filtered = useMemo(() => {
    const list = people.filter((p) => {
      if (type !== "all" && p.relationship_type !== type) return false;
      if (status !== "all" && p.status !== status) return false;
      if (priority !== "all" && p.priority !== priority) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = [p.name, p.company, p.role_title, p.email]
          .filter(Boolean)
          .map((s) => s!.toLowerCase())
          .join(" ");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          if (p !== 0) return p;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        case "last_contacted_at": {
          const av = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const bv = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          return bv - av;
        }
        case "created_at":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "next_follow_up_at":
        default: {
          const av = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
          const bv = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
          return av - bv;
        }
      }
    });
    return sorted;
  }, [people, q, type, status, priority, sortBy]);

  const groups = useMemo(() => {
    const map = new Map<PersonStatus, PersonRow[]>();
    for (const s of PERSON_STATUS_ORDER) map.set(s, []);
    for (const p of filtered) map.get(p.status)?.push(p);
    return PERSON_STATUS_ORDER.map((s) => ({ status: s, people: map.get(s) ?? [] }));
  }, [filtered]);

  const wrap = (fn: () => Promise<unknown>, label: string) => async () => {
    try {
      await fn();
      toast.success(label);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const buildHandlers = (p: PersonRow) => ({
    onContacted: wrap(() => m.markContacted(p), "Marked contacted"),
    onReplied: wrap(() => m.markReplied(p), "Marked replied"),
    onScheduleFollowUp: () => setFollowUpFor(p),
    onWaiting: wrap(() => m.markWaiting(p), "Marked waiting"),
    onDormant: wrap(() => m.markDormant(p), "Marked dormant"),
    onClosed: wrap(() => m.markClosed(p), "Marked closed"),
    onDelete: async () => {
      try {
        await m.deletePerson.mutateAsync(p.id);
        toast.success("Deleted", {
          action: { label: "Undo", onClick: () => m.restorePerson.mutateAsync(p.id) },
        });
      } catch (e: any) {
        toast.error(e.message ?? "Failed");
      }
    },
  });

  return (
    <div className="container max-w-5xl py-6 sm:py-10 animate-fade-in space-y-5">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">People</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {people.length} contact{people.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button onClick={() => setMode({ kind: "create" })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add person
        </Button>
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, role, email…"
            className="pl-8"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as RelationshipType | "all")}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {RELATIONSHIP_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{RELATIONSHIP_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as PersonStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PERSON_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{PERSON_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as PersonPriority | "all")}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {PERSON_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{PERSON_PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as PersonSort)}>
          <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERSON_SORT_LABEL) as PersonSort[]).map((s) => (
              <SelectItem key={s} value={s}>Sort: {PERSON_SORT_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant={grouped ? "default" : "outline"} size="sm" onClick={() => setGrouped((g) => !g)}>
            {grouped ? "Flat" : "Group"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTrashOpen(true)} aria-label="Deleted">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: "create" })} />
      ) : grouped ? (
        <div className="space-y-5">
          {groups.map(({ status: s, people: ps }) =>
            ps.length === 0 ? null : (
              <section key={s} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {PERSON_STATUS_LABEL[s]}
                  </h3>
                  <span className="text-xs text-muted-foreground">· {ps.length}</span>
                </div>
                <div className="space-y-1.5">
                  {ps.map((p) => (
                    <PersonRowItem
                      key={p.id}
                      person={p}
                      onOpen={(person) => setMode({ kind: "edit", person })}
                      {...buildHandlers(p)}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <PersonRowItem
              key={p.id}
              person={p}
              onOpen={(person) => setMode({ kind: "edit", person })}
              {...buildHandlers(p)}
            />
          ))}
        </div>
      )}

      <PersonDrawer mode={mode} onClose={() => setMode(null)} />
      <PeopleTrashSheet open={trashOpen} onOpenChange={setTrashOpen} />
      <FollowUpDialog person={followUpFor} onClose={() => setFollowUpFor(null)} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-10 text-center">
      <p className="text-sm text-muted-foreground">No people match your filters.</p>
      <Button onClick={onCreate} variant="outline" size="sm" className="mt-3">
        <Plus className="h-4 w-4 mr-1" /> Add person
      </Button>
    </div>
  );
}
