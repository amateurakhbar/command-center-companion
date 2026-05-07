import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2, LogOut, Loader2, Send, Copy, Check, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TrashSheet } from "@/components/tasks/TrashSheet";
import { useDeletedTasks } from "@/hooks/useTasks";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [morning, setMorning] = useState("09:00");
  const [midday, setMidday] = useState("13:30");
  const [evening, setEvening] = useState("20:30");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");

  const { data: deleted = [] } = useDeletedTasks();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name,timezone").eq("id", user.id).maybeSingle(),
      supabase
        .from("settings")
        .select("morning_time,midday_time,evening_time,quiet_hours_start,quiet_hours_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([{ data: prof }, { data: s }]) => {
      if (prof) {
        setDisplayName(prof.display_name ?? "");
        setTimezone(prof.timezone ?? "Europe/London");
      }
      if (s) {
        setMorning((s.morning_time ?? "09:00:00").slice(0, 5));
        setMidday((s.midday_time ?? "13:30:00").slice(0, 5));
        setEvening((s.evening_time ?? "20:30:00").slice(0, 5));
        setQuietStart(s.quiet_hours_start ? s.quiet_hours_start.slice(0, 5) : "");
        setQuietEnd(s.quiet_hours_end ? s.quiet_hours_end.slice(0, 5) : "");
      }
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const profileRes = await supabase
      .from("profiles")
      .update({ display_name: displayName, timezone })
      .eq("id", user.id);

    const settingsRes = await supabase
      .from("settings")
      .upsert(
        {
          user_id: user.id,
          morning_time: `${morning}:00`,
          midday_time: `${midday}:00`,
          evening_time: `${evening}:00`,
          quiet_hours_start: quietStart ? `${quietStart}:00` : null,
          quiet_hours_end: quietEnd ? `${quietEnd}:00` : null,
        },
        { onConflict: "user_id" }
      );

    setSaving(false);
    if (profileRes.error) return toast.error(profileRes.error.message);
    if (settingsRes.error) return toast.error(settingsRes.error.message);
    toast.success("Settings saved");
  };

  return (
    <div className="container max-w-3xl py-6 sm:py-10 animate-fade-in space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Profile, timezone, and reminder preferences (stored, used in Phase 2).
          </p>
        </div>
      </header>

      {/* Profile */}
      <Card className="p-6 bg-surface-1 space-y-5">
        <SectionTitle>Profile</SectionTitle>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      {/* Timezone */}
      <Card className="p-6 bg-surface-1 space-y-5">
        <SectionTitle>Timezone</SectionTitle>
        <div className="space-y-2">
          <Label htmlFor="tz">IANA timezone</Label>
          <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={loading} placeholder="Europe/London" />
          <p className="text-xs text-muted-foreground">Affects how task dates are rendered.</p>
        </div>
      </Card>

      {/* Reminders */}
      <Card className="p-6 bg-surface-1 space-y-5">
        <SectionTitle>Reminder preferences</SectionTitle>
        <p className="text-xs text-muted-foreground -mt-2">Stored now, scheduled in Phase 2.</p>
        <div className="grid grid-cols-3 gap-3">
          <TimeField id="morning" label="Morning" value={morning} onChange={setMorning} disabled={loading} />
          <TimeField id="midday" label="Midday" value={midday} onChange={setMidday} disabled={loading} />
          <TimeField id="evening" label="Evening" value={evening} onChange={setEvening} disabled={loading} />
        </div>
      </Card>

      {/* Quiet hours */}
      <Card className="p-6 bg-surface-1 space-y-5">
        <SectionTitle>Quiet hours</SectionTitle>
        <p className="text-xs text-muted-foreground -mt-2">No nudges between these times. Stored only for Phase 1.</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeField id="qs" label="Start" value={quietStart} onChange={setQuietStart} disabled={loading} />
          <TimeField id="qe" label="End" value={quietEnd} onChange={setQuietEnd} disabled={loading} />
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-6 bg-surface-1 space-y-2">
        <SectionTitle>Theme</SectionTitle>
        <p className="text-sm text-muted-foreground">Dark mode only in Phase 1.</p>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={loading || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>

      {/* Automation Health link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium text-sm">Automation Health</div>
            <div className="text-xs text-muted-foreground">View cron status, run email/.ics tests, and check Telegram nudges.</div>
          </div>
          <Button asChild variant="outline" size="sm"><a href="/automation-health">Open Automation Health</a></Button>
        </CardContent>
      </Card>

      {/* Daily email brief */}
      <DailyBriefCard />

      {/* Automation */}
      <AutomationCard />

      {/* Telegram */}
      <TelegramCard />

      {/* Trash */}
      <Card className="p-6 bg-surface-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Trash</div>
            <p className="text-xs text-muted-foreground mt-0.5">View and restore soft-deleted tasks.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTrashOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Open trash{deleted.length > 0 ? ` (${deleted.length})` : ""}
          </Button>
        </div>
      </Card>

      {/* Account */}
      <Card className="p-6 bg-surface-1">
        <SectionTitle>Account</SectionTitle>
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
          </Button>
        </div>
      </Card>

      <TrashSheet open={trashOpen} onOpenChange={setTrashOpen} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
      {children}
    </div>
  );
}

function TimeField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

const BOT_USERNAME = "ab_command_center_bot";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 15 * 60 * 1000;

type TelegramLink = { code: string; expires_at: string };

function generateCode(len = 8): string {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[arr[i] % CODE_CHARS.length];
  return out;
}

function TelegramCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<{ tgUserId: number | null; tgChatId: number | null }>({
    tgUserId: null,
    tgChatId: null,
  });
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([
      supabase.from("profiles").select("telegram_user_id, telegram_chat_id").eq("id", user.id).maybeSingle(),
      supabase.from("settings").select("preferences").eq("user_id", user.id).maybeSingle(),
    ]).then(([{ data: prof }, { data: s }]) => {
      if (!mounted) return;
      setLinked({
        tgUserId: prof?.telegram_user_id ?? null,
        tgChatId: prof?.telegram_chat_id ?? null,
      });
      const prefs = (s?.preferences as any) ?? {};
      const tgLink = prefs.telegram_link as TelegramLink | undefined;
      if (tgLink && new Date(tgLink.expires_at).getTime() > Date.now()) {
        setLink(tgLink);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Tick for countdown
  useEffect(() => {
    if (!link) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [link]);

  const isConnected = linked.tgUserId !== null;
  const remainingMs = link ? new Date(link.expires_at).getTime() - now : 0;
  const codeExpired = link && remainingMs <= 0;

  const generate = async () => {
    if (!user) return;
    setBusy(true);
    const newLink: TelegramLink = {
      code: generateCode(),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    };
    const { data: existing } = await supabase
      .from("settings")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
    const newPrefs = { ...prefs, telegram_link: newLink };
    const { error } = await supabase
      .from("settings")
      .upsert({ user_id: user.id, preferences: newPrefs }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLink(newLink);
    setNow(Date.now());
    toast.success("Connection code generated");
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const disconnect = async () => {
    if (!user) return;
    setBusy(true);
    const profRes = await supabase
      .from("profiles")
      .update({ telegram_user_id: null, telegram_chat_id: null })
      .eq("id", user.id);
    const { data: existing } = await supabase
      .from("settings")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
    delete (prefs as any).telegram_link;
    await supabase
      .from("settings")
      .upsert({ user_id: user.id, preferences: prefs as any }, { onConflict: "user_id" });
    setBusy(false);
    if (profRes.error) return toast.error(profRes.error.message);
    setLinked({ tgUserId: null, tgChatId: null });
    setLink(null);
    toast.success("Telegram disconnected");
  };

  const fmtRemaining = () => {
    const s = Math.max(0, Math.floor(remainingMs / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="p-6 bg-surface-1 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Telegram</SectionTitle>
        {isConnected ? (
          <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Connected
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            Not connected
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Linked to Telegram user <span className="font-mono text-foreground">{linked.tgUserId}</span>
            {" · "}chat <span className="font-mono text-foreground">{linked.tgChatId}</span>.
          </p>
          <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link your Telegram account to capture tasks from chat (Stage 2).
          </p>

          {link && !codeExpired ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg tracking-widest px-3 py-2 rounded bg-background border border-border">
                  {link.code}
                </code>
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <span className="text-xs text-muted-foreground font-mono">expires in {fmtRemaining()}</span>
              </div>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>
                  Open Telegram and message{" "}
                  <a
                    href={`https://t.me/${BOT_USERNAME}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-mono"
                  >
                    @{BOT_USERNAME}
                  </a>
                </li>
                <li>
                  Send: <code className="font-mono text-foreground">/connect {link.code}</code>
                </li>
                <li>Refresh this page to confirm the link.</li>
              </ol>
              <Button variant="ghost" size="sm" onClick={generate} disabled={busy}>
                Generate a new code
              </Button>
            </div>
          ) : (
            <Button onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Generate connection code
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

type NudgePrefs = {
  ai_parser_enabled: boolean;
  telegram_nudges_enabled: boolean;
  morning_brief_enabled: boolean;
  midday_check_enabled: boolean;
  evening_closeout_enabled: boolean;
  overdue_escalation_enabled: boolean;
  draft_assistant_enabled: boolean;
};

const NUDGE_DEFAULTS: NudgePrefs = {
  ai_parser_enabled: true,
  telegram_nudges_enabled: false,
  morning_brief_enabled: true,
  midday_check_enabled: true,
  evening_closeout_enabled: true,
  overdue_escalation_enabled: true,
  draft_assistant_enabled: true,
};

function AutomationCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NudgePrefs>(NUDGE_DEFAULTS);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("settings").select("preferences").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const p = (data?.preferences as any) ?? {};
        setPrefs({
          ai_parser_enabled: p.ai_parser_enabled !== false,
          telegram_nudges_enabled: p.telegram_nudges_enabled === true,
          morning_brief_enabled: p.morning_brief_enabled !== false,
          midday_check_enabled: p.midday_check_enabled !== false,
          evening_closeout_enabled: p.evening_closeout_enabled !== false,
          overdue_escalation_enabled: p.overdue_escalation_enabled !== false,
          draft_assistant_enabled: p.draft_assistant_enabled !== false,
        });
        setLoading(false);
      });
  }, [user]);

  const setKey = async (key: keyof NudgePrefs, next: boolean) => {
    if (!user) return;
    setSaving(true);
    const prev = prefs[key];
    setPrefs(p => ({ ...p, [key]: next }));
    const { data: existing } = await supabase
      .from("settings").select("preferences").eq("user_id", user.id).maybeSingle();
    const merged = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
    (merged as any)[key] = next;
    const { error } = await supabase
      .from("settings").upsert([{ user_id: user.id, preferences: merged as any }], { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setPrefs(p => ({ ...p, [key]: prev }));
      toast.error(error.message);
    } else {
      toast.success("Saved");
    }
  };

  const Row = ({ k, label, desc, disabled }: { k: keyof NudgePrefs; label: string; desc?: string; disabled?: boolean }) => (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {desc && <p className="text-xs text-muted-foreground max-w-md">{desc}</p>}
      </div>
      <Switch checked={prefs[k]} disabled={loading || saving || disabled} onCheckedChange={(v) => setKey(k, v)} />
    </div>
  );

  return (
    <Card className="p-6 bg-surface-1 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Automation</SectionTitle>
        <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          AI configured
        </span>
      </div>
      <Row k="ai_parser_enabled" label="Natural language task capture" desc="Send Telegram messages in plain English; slash commands always bypass AI." />
      <div className="border-t border-border/40 pt-5 space-y-4">
        <Row
          k="telegram_nudges_enabled"
          label="Telegram nudges"
          desc="Master switch. When off, scheduled morning/midday/evening/overdue Telegram nudges are skipped."
        />
        <Row k="morning_brief_enabled" label="Morning brief" disabled={!prefs.telegram_nudges_enabled} />
        <Row k="midday_check_enabled" label="Midday check" disabled={!prefs.telegram_nudges_enabled} />
        <Row k="evening_closeout_enabled" label="Evening closeout" disabled={!prefs.telegram_nudges_enabled} />
        <Row k="overdue_escalation_enabled" label="Overdue escalation" disabled={!prefs.telegram_nudges_enabled} />
        <Row k="draft_assistant_enabled" label="Draft assistant (/draft)" />
      </div>
    </Card>
  );
}


function DailyBriefCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [sender, setSender] = useState<string | null>(null);
  const [providerOk, setProviderOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("settings").select("preferences").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.preferences as any) ?? {};
        setEnabled(prefs.daily_email_brief_enabled !== false);
        setLoading(false);
      });
    supabase.functions.invoke("daily-evening-brief", { body: { probe: true } })
      .then(({ data, error }) => {
        if (error) { setProviderOk(false); return; }
        const d: any = data ?? {};
        setProviderOk(d.configured === true);
        setRecipient(d.recipient ?? null);
        setSender(d.sender ?? null);
      })
      .catch(() => setProviderOk(false));
  }, [user]);

  const toggle = async (next: boolean) => {
    if (!user) return;
    setSaving(true);
    setEnabled(next);
    const { data: existing } = await supabase.from("settings").select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
    (prefs as any).daily_email_brief_enabled = next;
    const { error } = await supabase.from("settings").upsert([{ user_id: user.id, preferences: prefs as any }], { onConflict: "user_id" });
    setSaving(false);
    if (error) { setEnabled(!next); toast.error(error.message); }
    else toast.success(next ? "Daily brief enabled" : "Daily brief disabled");
  };

  const sendTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("daily-evening-brief", { body: { test: true, force: true } });
    setTesting(false);
    if (error) return toast.error(error.message);
    const d: any = data;
    if (d?.success) {
      toast.success(`Test brief sent to ${d.recipient} (${d.counts?.total ?? 0} tasks)`);
    } else if (d?.reason === "sender_or_recipient_not_verified") {
      toast.error(d.message, { duration: 10000 });
    } else {
      toast.error(d?.message || d?.error || "Failed to send test brief");
    }
  };

  const usingTestSender = (sender ?? "").includes("onboarding@resend.dev");

  return (
    <Card className="p-6 bg-surface-1 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Daily email brief</SectionTitle>
        {providerOk === null ? null : providerOk ? (
          <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">configured</span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">not configured</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Enable daily brief</div>
          <p className="text-xs text-muted-foreground max-w-md">
            Sends an evening email with grouped pending tasks and an Apple Calendar invite for the night execution block (10:00 PM – 3:00 AM Pakistan time). Scheduled at 5:00 PM Pakistan time.
          </p>
          {recipient && <p className="text-xs text-muted-foreground">Recipient: <span className="font-mono">{recipient}</span></p>}
          {sender && <p className="text-xs text-muted-foreground">Sender: <span className="font-mono">{sender}</span></p>}
          {usingTestSender && (
            <p className="text-xs text-amber-400/90 max-w-md">
              Using Resend test sender. This may only send to the Resend account owner or a verified recipient. Add a custom domain later for production sending.
            </p>
          )}
        </div>
        <Switch checked={enabled} disabled={loading || saving} onCheckedChange={toggle} />
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={sendTest} disabled={testing || providerOk === false}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send test brief now
        </Button>
      </div>
    </Card>
  );
}

