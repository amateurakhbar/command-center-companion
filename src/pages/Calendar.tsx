import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Loader2, Download, Mail, AlertTriangle } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskRow } from "@/lib/tasks";
import { groupRemaining, isRemaining } from "@/lib/remaining";
import { buildIcsForRemaining, downloadIcs } from "@/lib/ics";
import { TaskRowItem } from "@/components/tasks/TaskRowItem";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { BreakDownDialog } from "@/components/tasks/BreakDownDialog";
import { KillTaskDialog } from "@/components/tasks/KillTaskDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = { kind: "edit"; task: TaskRow } | null;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const [mode, setMode] = useState<Mode>(null);
  const [breakDownTask, setBreakDownTask] = useState<TaskRow | null>(null);
  const [killTask, setKillTask] = useState<TaskRow | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke("email-calendar-export", { body: { probe: true } })
      .then(({ data }) => { if (active) setEmailConfigured(!!data?.configured); })
      .catch(() => { if (active) setEmailConfigured(false); });
    return () => { active = false; };
  }, []);

  const remaining = useMemo(() => tasks.filter(isRemaining), [tasks]);
  const dated = remaining.filter((t) => t.due_at);
  const unscheduled = remaining.filter((t) => !t.due_at);
  const grouped = groupRemaining(tasks);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const exportIcs = () => {
    if (dated.length === 0) {
      toast.info("No dated tasks to export.");
      return;
    }
    const ics = buildIcsForRemaining(remaining, { tz });
    downloadIcs("ab-command-center-remaining-tasks.ics", ics);
    toast.success("Downloaded .ics");
  };

  const emailIcs = async () => {
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-calendar-export", { body: {} });
      if (error) throw error;
      if (data?.error === "not_configured") {
        toast.error("Email export is not configured. Download the .ics file instead.");
      } else {
        toast.success("Email sent");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Email failed. Download instead.");
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="container max-w-5xl py-6 sm:py-10 animate-fade-in space-y-5">
      <header className="flex items-start gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CalendarIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">Calendar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dated.length} dated · {unscheduled.length} unscheduled · {grouped.overdue.length} overdue
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportIcs}>
              <Download className="h-4 w-4 mr-1.5" /> Export .ics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={emailIcs}
              disabled={emailing || emailConfigured === false}
              title={emailConfigured === false ? "Email export not configured" : undefined}
            >
              {emailing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
              Email .ics
            </Button>
          </div>
          {emailConfigured === false && (
            <p className="text-[10px] text-muted-foreground">Email export not configured — download instead.</p>
          )}
        </div>
      </header>

      {grouped.overdue.length > 0 && (
        <Card className="p-3 bg-destructive/10 border-destructive/30 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm">{grouped.overdue.length} overdue task{grouped.overdue.length === 1 ? "" : "s"}.</span>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="agenda">
          <TabsList>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="space-y-4 mt-4">
            <AgendaView tasks={dated} onOpen={(t) => setMode({ kind: "edit", task: t })} onBreakDown={setBreakDownTask} onKill={setKillTask} />
          </TabsContent>
          <TabsContent value="week" className="mt-4">
            <WeekView tasks={dated} onOpen={(t) => setMode({ kind: "edit", task: t })} onBreakDown={setBreakDownTask} onKill={setKillTask} />
          </TabsContent>
          <TabsContent value="month" className="mt-4">
            <MonthView tasks={dated} />
          </TabsContent>
        </Tabs>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Unscheduled <span>· {unscheduled.length}</span>
        </h3>
        {unscheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unscheduled tasks.</p>
        ) : (
          <div className="space-y-1.5">
            {unscheduled.map((t) => (
              <TaskRowItem
                key={t.id}
                task={t}
                onOpen={(task) => setMode({ kind: "edit", task })}
                onBreakDown={setBreakDownTask}
                onKill={setKillTask}
              />
            ))}
          </div>
        )}
      </section>

      <TaskDrawer mode={mode} onClose={() => setMode(null)} />
      <BreakDownDialog task={breakDownTask} onClose={() => setBreakDownTask(null)} />
      <KillTaskDialog task={killTask} onClose={() => setKillTask(null)} />
    </div>
  );
}

function AgendaView({ tasks, onOpen, onBreakDown, onKill }: { tasks: TaskRow[]; onOpen: (t: TaskRow) => void; onBreakDown: (t: TaskRow) => void; onKill: (t: TaskRow) => void }) {
  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    [...tasks].sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()).forEach((t) => {
      const d = new Date(t.due_at!);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No dated tasks.</p>;
  }

  return (
    <div className="space-y-4">
      {[...byDay.entries()].map(([key, items]) => {
        const d = new Date(items[0].due_at!);
        return (
          <section key={key} className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} <span>· {items.length}</span>
            </h3>
            <div className="space-y-1.5">
              {items.map((t) => (
                <TaskRowItem key={t.id} task={t} onOpen={onOpen} onBreakDown={onBreakDown} onKill={onKill} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WeekView({ tasks, onOpen, onBreakDown, onKill }: { tasks: TaskRow[]; onOpen: (t: TaskRow) => void; onBreakDown: (t: TaskRow) => void; onKill: (t: TaskRow) => void }) {
  const start = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const items = tasks
          .filter((t) => sameDay(new Date(t.due_at!), d))
          .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
        return (
          <Card key={d.toISOString()} className="p-2 bg-surface-1 min-h-[140px]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
              {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
            </div>
            <div className="space-y-1">
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className="w-full text-left text-xs rounded-md border border-border bg-background/40 px-2 py-1 hover:bg-surface-2"
                >
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {new Date(t.due_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {t.status === "waiting" ? " · Waiting" : ""}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({ tasks }: { tasks: TaskRow[] }) {
  const today = new Date();
  const first = startOfMonth(today);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center py-1">{d}</div>
      ))}
      {cells.map((d) => {
        const items = tasks.filter((t) => sameDay(new Date(t.due_at!), d));
        const isCurMonth = d.getMonth() === today.getMonth();
        return (
          <div
            key={d.toISOString()}
            className={`min-h-[80px] rounded-md border border-border p-1 text-xs ${isCurMonth ? "bg-surface-1" : "bg-background/40 opacity-60"}`}
          >
            <div className={`text-[10px] mb-1 ${sameDay(d, today) ? "text-primary font-bold" : "text-muted-foreground"}`}>{d.getDate()}</div>
            <div className="space-y-0.5">
              {items.slice(0, 3).map((t) => (
                <div key={t.id} className="truncate text-[10px] rounded bg-primary/10 text-primary px-1">
                  {t.title}
                </div>
              ))}
              {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
