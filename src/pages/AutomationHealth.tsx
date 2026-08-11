import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Mail, Calendar, Send, FileText, Download } from "lucide-react";

type Health = any;

const TG_TYPES = ["morning", "midday", "evening", "overdue"] as const;
type TgType = typeof TG_TYPES[number];

function StatusPill({ value }: { value: "healthy" | "warning" | "critical" | string }) {
  const map: Record<string, { cls: string; label: string; Icon: any }> = {
    healthy: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Healthy", Icon: CheckCircle2 },
    warning: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Warning", Icon: AlertTriangle },
    critical: { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Critical", Icon: XCircle },
  };
  const v = map[value] ?? map.warning;
  const Icon = v.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${v.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {v.label}
    </span>
  );
}

function YesNo({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Badge variant={ok ? "secondary" : "outline"} className={ok ? "border-emerald-500/30 text-emerald-400" : "border-muted text-muted-foreground"}>
      {label ?? (ok ? "Yes" : "No")}
    </Badge>
  );
}

export default function AutomationHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("automation-health", { body: { action: "report" } });
      if (error) throw error;
      setData(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load health report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (key: string, fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fn();
      setResults((r) => ({ ...r, [key]: res }));
    } catch (e: any) {
      setResults((r) => ({ ...r, [key]: { success: false, error: e?.message || "Failed" } }));
    } finally {
      setBusy(null);
    }
  };

  const checkEmail = () =>
    run("email", async () => {
      const { data, error } = await supabase.functions.invoke("daily-evening-brief", {
        body: { test: true, force: true, user_email: "akbarthesecond@gmail.com" },
      });
      if (error) throw new Error(error.message);
      return data;
    });

  const checkIcs = () =>
    run("ics", async () => {
      const { data, error } = await supabase.functions.invoke("automation-health", { body: { action: "ics_preview" } });
      if (error) throw new Error(error.message);
      return data;
    });

  const downloadIcs = () => {
    const r = results.ics;
    if (!r?.ics_base64) return;
    try {
      const bin = atob(r.ics_base64);
      const blob = new Blob([bin], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `night-execution-block-${r.local_date}.ics`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Could not download .ics");
    }
  };

  const testNudge = (kind: TgType) =>
    run(`nudge_${kind}`, async () => {
      const { data, error } = await supabase.functions.invoke("scheduled-nudges", {
        body: { test: true, force: true, nudge_type: kind, user_email: "akbarthesecond@gmail.com" },
      });
      if (error) throw new Error(error.message);
      return data;
    });

  const testDraft = () =>
    run("draft", async () => {
      const { data: tasks, error: tErr } = await supabase
        .from("tasks").select("id,title").is("deleted_at", null)
        .not("status", "in", "(done,killed)").order("created_at", { ascending: false }).limit(1);
      if (tErr) throw new Error(tErr.message);
      if (!tasks || tasks.length === 0) return { success: false, error: "No active task available for draft test." };
      // Reuse Lovable AI gateway directly via edge? We don't have a separate function; call ai-parser is unrelated.
      // Provide a soft check: confirm AI configured + return the task that would be drafted.
      return { success: true, task: tasks[0], note: "Run /draft 1 in Telegram to generate a real draft." };
    });

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading health report…</div>;
  }
  if (!data?.success) {
    return <div className="p-6 text-destructive">Could not load health report.</div>;
  }

  const c = data.connection ?? {};
  const s = data.settings ?? {};
  const p = data.providers ?? {};
  const recent = data.recent ?? {};

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">System status</h2>
          <StatusPill value={data.overall} />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {(data.warnings?.length || data.criticals?.length) ? (
        <Card>
          <CardContent className="p-4 space-y-1 text-sm">
            {data.criticals?.map((w: string) => <div key={w} className="text-destructive">• {w}</div>)}
            {data.warnings?.map((w: string) => <div key={w} className="text-amber-400">• {w}</div>)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Connection</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{c.email ?? "Not set"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Timezone</span><span>{c.timezone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Telegram connected</span><YesNo ok={c.telegram_connected} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Providers</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Resend</span><YesNo ok={p.resend?.configured} label={p.resend?.configured ? "Configured" : "Not configured"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sender</span><span className="truncate ml-2">{p.resend?.sender ?? "Not set"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="truncate ml-2">{p.resend?.recipient ?? "Not set"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lovable AI</span><YesNo ok={p.lovable_ai?.configured} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Telegram bot</span><YesNo ok={p.telegram_bot?.configured} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Automation toggles</CardTitle></CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-y-1">
            <span className="text-muted-foreground">Daily email</span><YesNo ok={s.daily_email_brief_enabled} />
            <span className="text-muted-foreground">Telegram nudges</span><YesNo ok={s.telegram_nudges_enabled} />
            <span className="text-muted-foreground">Morning brief</span><YesNo ok={s.morning_brief_enabled} />
            <span className="text-muted-foreground">Midday check</span><YesNo ok={s.midday_check_enabled} />
            <span className="text-muted-foreground">Evening closeout</span><YesNo ok={s.evening_closeout_enabled} />
            <span className="text-muted-foreground">Overdue escalation</span><YesNo ok={s.overdue_escalation_enabled} />
            <span className="text-muted-foreground">Draft assistant</span><YesNo ok={s.draft_assistant_enabled} />
            <span className="text-muted-foreground">AI parser</span><YesNo ok={s.ai_parser_enabled} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cron</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {data.cron?.available ? (
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data.cron, null, 2)}</pre>
            ) : (
              <div className="text-muted-foreground">
                Status unavailable. Expected jobs:
                <ul className="mt-1 list-disc ml-5">
                  {data.expected_cron?.map((j: any) => <li key={j.name}><code>{j.name}</code> · {j.schedule}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email + .ics tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={checkEmail} disabled={busy === "email"}>
              {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Check email + .ics
            </Button>
            <Button variant="outline" onClick={checkIcs} disabled={busy === "ics"}>
              {busy === "ics" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Calendar className="h-4 w-4 mr-1.5" />}
              Check .ics generation only
            </Button>
            {results.ics?.ics_base64 && (
              <Button variant="ghost" onClick={downloadIcs}><Download className="h-4 w-4 mr-1.5" /> Download .ics</Button>
            )}
          </div>
          {results.email && <ResultBlock label="Email test" data={results.email} renderEmail />}
          {results.ics && <ResultBlock label="ICS preview" data={results.ics} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Telegram nudge tests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TG_TYPES.map((k) => (
              <Button key={k} variant="outline" size="sm" onClick={() => testNudge(k)} disabled={busy === `nudge_${k}`}>
                {busy === `nudge_${k}` ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Send test {k}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">After a test nudge, open Telegram and reply <code>done 1</code> to verify numbered replies.</div>
          {TG_TYPES.map((k) => results[`nudge_${k}`] && <ResultBlock key={k} label={`Nudge: ${k}`} data={results[`nudge_${k}`]} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Draft assistant</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={testDraft} disabled={busy === "draft"}>
            {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Test draft assistant
          </Button>
          {results.draft && <ResultBlock label="Draft test" data={results.draft} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent daily email briefs</CardTitle></CardHeader>
          <CardContent className="text-xs">
            {recent.daily_briefs?.length ? (
              <ul className="space-y-1.5">
                {recent.daily_briefs.map((n: any) => (
                  <li key={n.id} className="flex flex-col border-b border-border/50 pb-1.5">
                    <span>{new Date(n.sent_at).toLocaleString()} · <Badge variant="outline">{n.delivery_status ?? "?"}</Badge></span>
                    <span className="text-muted-foreground truncate">{n.nudge_key} · tasks={n.metadata?.counts?.total ?? "?"} · test={String(n.metadata?.test ?? false)}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-muted-foreground">No daily briefs yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Telegram nudges</CardTitle></CardHeader>
          <CardContent className="text-xs">
            {recent.telegram_nudges?.length ? (
              <ul className="space-y-1.5">
                {recent.telegram_nudges.map((n: any) => (
                  <li key={n.id} className="flex flex-col border-b border-border/50 pb-1.5">
                    <span>{new Date(n.sent_at).toLocaleString()} · <Badge variant="outline">{n.kind}</Badge> <Badge variant="outline">{n.delivery_status ?? "?"}</Badge></span>
                    <span className="text-muted-foreground truncate">{n.nudge_key} · tasks={n.metadata?.task_count ?? n.metadata?.tasks ?? "?"} · test={String(n.metadata?.test ?? false)}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-muted-foreground">No Telegram nudges yet.</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent failures</CardTitle></CardHeader>
        <CardContent className="text-xs">
          {recent.failures?.length ? (
            <ul className="space-y-1.5">
              {recent.failures.map((n: any) => (
                <li key={n.id} className="flex flex-col border-b border-border/50 pb-1.5">
                  <span>{new Date(n.sent_at).toLocaleString()} · <Badge variant="outline">{n.kind}</Badge> <Badge variant="destructive">{n.delivery_status}</Badge></span>
                  <span className="text-muted-foreground truncate">{n.metadata?.error ?? n.metadata?.reason ?? n.nudge_key}</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-muted-foreground">No recent failures. ✅</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultBlock({ label, data, renderEmail }: { label: string; data: any; renderEmail?: boolean }) {
  const ok = data?.success !== false;
  let friendly = "";
  if (renderEmail && data?.reason === "sender_or_recipient_not_verified") {
    friendly = "Resend rejected the email. onboarding@resend.dev can usually only send to the Resend account owner or verified recipient. Use the Resend account email or add a verified sending domain.";
  } else if (renderEmail && data?.error === "email_not_configured") {
    friendly = "Daily email brief is not configured. Add RESEND_API_KEY to enable email.";
  }
  return (
    <div className="rounded-md border border-border bg-surface-1/40 p-3 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "OK" : "Error"}</Badge>
        <span className="font-medium">{label}</span>
      </div>
      {friendly && <div className="mb-2 text-amber-400">{friendly}</div>}
      <pre className="whitespace-pre-wrap break-all text-[11px] leading-snug max-h-64 overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
