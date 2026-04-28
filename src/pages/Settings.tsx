import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TrashSheet } from "@/components/tasks/TrashSheet";
import { useDeletedTasks } from "@/hooks/useTasks";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [trashOpen, setTrashOpen] = useState(false);
  const { data: deleted = [] } = useDeletedTasks();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name,timezone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setTimezone(data.timezone ?? "Europe/London");
        }
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, timezone })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  return (
    <div className="container max-w-3xl py-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Profile and timezone. Reminders come in Phase 2.</p>
        </div>
      </div>

      <Card className="p-6 bg-surface-1 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={loading}
            placeholder="Europe/London"
          />
          <p className="text-xs text-muted-foreground">IANA timezone (e.g. Europe/London, America/New_York).</p>
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>

        <Button onClick={save} disabled={loading || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </Card>

      <Card className="p-6 bg-surface-1 mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Trash</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              View and restore soft-deleted tasks.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTrashOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Open trash{deleted.length > 0 ? ` (${deleted.length})` : ""}
          </Button>
        </div>
      </Card>

      <TrashSheet open={trashOpen} onOpenChange={setTrashOpen} />
    </div>
  );
}
