import { useMemo, useState } from "react";
import { BarChart3, Loader2, Save } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskRow, isOverdue } from "@/lib/tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type DayStats = {
  done: number;
  killed: number;
  delayed: number;
  overdue24h: number;
  highPriorityDone: number;
  score: number;
};

function computeStatsForDay(tasks: TaskRow[], day: Date): DayStats {
  let done = 0,
    killed = 0,
    delayed = 0,
    overdue24h = 0,
    highPriorityDone = 0;

  for (const t of tasks) {
    if (t.completed_at && isSameDay(new Date(t.completed_at), day)) {
      done += 1;
      if (t.priority === "high") highPriorityDone += 1;
    }
    if (t.killed_at && isSameDay(new Date(t.killed_at), day) && t.killed_reason) {
      killed += 1;
    }
    if (t.last_delayed_at && isSameDay(new Date(t.last_delayed_at), day)) {
      delayed += 1;
    }
    // Overdue >24h is point-in-time (today only is meaningful)
    if (
      isSameDay(day, new Date()) &&
      t.status !== "done" &&
      t.status !== "killed" &&
      t.status !== "waiting" &&
      t.due_at &&
      Date.now() - new Date(t.due_at).getTime() > 24 * 3600_000
    ) {
      overdue24h += 1;
    }
  }

  const score =
    done * 10 + killed * 3 - delayed * 2 - overdue24h * 5 + highPriorityDone * 5;

  return { done, killed, delayed, overdue24h, highPriorityDone, score };
}

export default function Score() {
  const { data: tasks = [], isLoading } = useTasks();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["daily_logs", "recent"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("log_date,score")
        .order("log_date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = useMemo(() => computeStatsForDay(tasks, new Date()), [tasks]);

  const week = useMemo(() => {
    const days: { date: Date; score: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const log = logs.find((l) => l.log_date === ymd(d));
      const score = log?.score ?? (i === 0 ? today.score : computeStatsForDay(tasks, d).score);
      days.push({ date: d, score });
    }
    return days;
  }, [tasks, logs, today.score]);

  const stalest = useMemo(() => {
    return [...tasks]
      .filter(
        (t) => t.status !== "done" && t.status !== "killed" && !t.deleted_at
      )
      .sort(
        (a, b) =>
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      )
      .slice(0, 3);
  }, [tasks]);

  const oldestOverdue = useMemo(() => {
    return [...tasks]
      .filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "killed" &&
          t.status !== "waiting" &&
          !t.deleted_at &&
          isOverdue(t.due_at)
      )
      .sort(
        (a, b) =>
          new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()
      )
      .slice(0, 3);
  }, [tasks]);

  const saveSnapshot = async () => {
    if (!user) return;
    setSaving(true);
    const log_date = ymd(new Date());
    const summary = {
      done: today.done,
      killed: today.killed,
      delayed: today.delayed,
      overdue24h: today.overdue24h,
      highPriorityDone: today.highPriorityDone,
    };
    const { error } = await supabase.from("daily_logs").upsert(
      {
        user_id: user.id,
        log_date,
        score: today.score,
        closeout_at: new Date().toISOString(),
        summary,
      },
      { onConflict: "user_id,log_date" }
    );
    setSaving(false);
    if (error) {
      // fallback if no unique constraint (single insert)
      const { error: e2 } = await supabase.from("daily_logs").insert({
        user_id: user.id,
        log_date,
        score: today.score,
        closeout_at: new Date().toISOString(),
        summary,
      });
      if (e2) return toast.error(e2.message);
    }
    toast.success("Snapshot saved");
    qc.invalidateQueries({ queryKey: ["daily_logs", "recent"] });
  };

  const max = Math.max(10, ...week.map((d) => Math.abs(d.score)));

  return (
    <div className="container max-w-4xl py-6 sm:py-10 animate-fade-in space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">Execution Score</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Today's output, computed from your tasks.
          </p>
        </div>
        <Button onClick={saveSnapshot} disabled={saving || isLoading} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save snapshot
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="p-6 bg-surface-1 grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                Today's score
              </div>
              <div
                className={`font-mono text-5xl sm:text-6xl font-semibold ${
                  today.score >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {today.score}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 self-center">
              <Stat label="Done" value={today.done} tone="success" />
              <Stat label="High done" value={today.highPriorityDone} tone="primary" />
              <Stat label="Killed" value={today.killed} tone="muted" />
              <Stat label="Delayed" value={today.delayed} tone="warning" />
              <Stat label="Overdue 24h+" value={today.overdue24h} tone="destructive" />
            </div>
          </Card>

          <Card className="p-6 bg-surface-1 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              7-day trend
            </div>
            <div className="flex items-end justify-between gap-1.5 h-24">
              {week.map((d, i) => {
                const h = max === 0 ? 0 : (Math.abs(d.score) / max) * 100;
                const positive = d.score >= 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={`w-full rounded-t-sm ${
                          positive ? "bg-primary/70" : "bg-destructive/70"
                        }`}
                        style={{ height: `${h}%`, minHeight: d.score === 0 ? 1 : 4 }}
                        title={`${ymd(d.date)} · ${d.score}`}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono">
                      {d.date.toLocaleDateString(undefined, { weekday: "short" })[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 bg-surface-1 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              Breakdown
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                <Row label="Done today" sub="+10 each" value={today.done * 10} />
                <Row
                  label="High-priority done"
                  sub="+5 bonus each"
                  value={today.highPriorityDone * 5}
                />
                <Row
                  label="Killed with reason"
                  sub="+3 each"
                  value={today.killed * 3}
                />
                <Row
                  label="Delayed today"
                  sub="-2 each"
                  value={today.delayed * -2}
                />
                <Row
                  label="Overdue >24h"
                  sub="-5 each"
                  value={today.overdue24h * -5}
                />
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-2 text-sm font-semibold">Total</td>
                  <td />
                  <td className="py-2 text-right font-mono font-semibold">
                    {today.score}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 bg-surface-1 space-y-2">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                Stalest open tasks
              </div>
              {stalest.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing open.</p>
              ) : (
                <ul className="space-y-1.5">
                  {stalest.map((t) => (
                    <li
                      key={t.id}
                      className="text-sm flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {Math.round(
                          (Date.now() - new Date(t.updated_at).getTime()) /
                            (24 * 3600_000)
                        )}
                        d
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5 bg-surface-1 space-y-2">
              <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                Oldest overdue tasks
              </div>
              {oldestOverdue.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing overdue.</p>
              ) : (
                <ul className="space-y-1.5">
                  {oldestOverdue.map((t) => (
                    <li
                      key={t.id}
                      className="text-sm flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="text-[11px] text-destructive shrink-0">
                        {Math.round(
                          (Date.now() - new Date(t.due_at!).getTime()) /
                            (24 * 3600_000)
                        )}
                        d late
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive" | "primary" | "muted";
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "destructive"
      ? "text-destructive"
      : tone === "primary"
      ? "text-primary"
      : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
        {label}
      </div>
      <div className={`font-mono text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function Row({
  label,
  sub,
  value,
}: {
  label: string;
  sub: string;
  value: number;
}) {
  return (
    <tr>
      <td className="py-2">
        <div className="text-sm">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </td>
      <td />
      <td
        className={`py-2 text-right font-mono ${
          value > 0
            ? "text-success"
            : value < 0
            ? "text-destructive"
            : "text-muted-foreground"
        }`}
      >
        {value > 0 ? `+${value}` : value}
      </td>
    </tr>
  );
}
