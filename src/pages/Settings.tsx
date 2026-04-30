import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2, LogOut, Loader2, Send, Copy, Check } from "lucide-react";
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
