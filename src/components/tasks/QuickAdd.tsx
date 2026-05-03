import { useEffect, useState, KeyboardEvent } from "react";
import { Plus, Loader2, Sparkles, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTaskMutations } from "@/hooks/useTasks";
import { parseQuickAdd, TaskInsert, TaskCategory, TaskPriority } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  defaults?: Partial<TaskInsert>;
  placeholder?: string;
};

type AIParsedTask = {
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  due_at: string | null;
  person_name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  notes?: string | null;
  next_action?: string | null;
};

type AIResult = {
  success: boolean;
  needs_clarification: boolean;
  clarification_question: string | null;
  tasks: AIParsedTask[];
  raw_input_id: string | null;
  error?: string;
};

type Preview = {
  tasks: AIParsedTask[];
  rawInputId: string | null;
};

export function QuickAdd({ defaults, placeholder }: Props) {
  const m = useTaskMutations();
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiAvailable, setAiAvailable] = useState<boolean>(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);

  // Load user pref
  useEffect(() => {
    if (!user) return;
    supabase
      .from("settings")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.preferences as any) ?? {};
        setAiEnabled(prefs.ai_parser_enabled !== false);
      });
  }, [user]);

  const toggleAi = async () => {
    if (!user) return;
    const next = !aiEnabled;
    setAiEnabled(next);
    const { data: existing } = await supabase
      .from("settings").select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = ((existing?.preferences as any) ?? {}) as Record<string, unknown>;
    (prefs as any).ai_parser_enabled = next;
    await supabase.from("settings").upsert(
      [{ user_id: user.id, preferences: prefs as any }],
      { onConflict: "user_id" },
    );
  };

  const submitRegex = async () => {
    const parsed = parseQuickAdd(value);
    if (!parsed.title) return;
    await m.create.mutateAsync({
      ...defaults,
      title: parsed.title,
      priority: parsed.priority ?? defaults?.priority ?? "medium",
      category: parsed.category ?? defaults?.category ?? "admin",
      due_at: parsed.due_at ?? defaults?.due_at ?? null,
    });
    setValue("");
  };

  const submitAI = async (text: string) => {
    const { data, error } = await supabase.functions.invoke("ai-parser", {
      body: {
        user_id: user!.id,
        text,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        current_time_iso: new Date().toISOString(),
        source: "ai_parser",
      },
    });
    if (error) throw error;
    const result = data as AIResult;
    if (!result?.success) {
      if (result?.error === "ai_not_configured") setAiAvailable(false);
      throw new Error(result?.error || "ai_failed");
    }
    if (result.needs_clarification) {
      setClarification(result.clarification_question || "Please clarify.");
      return;
    }
    if (!result.tasks?.length) {
      throw new Error("no_tasks");
    }
    if (result.tasks.length === 1 && (result.tasks[0] as any).confidence !== undefined && (result.tasks[0] as any).confidence >= 0.7) {
      await createParsed(result.tasks, result.raw_input_id);
      setValue("");
      return;
    }
    if (result.tasks.length === 1) {
      await createParsed(result.tasks, result.raw_input_id);
      setValue("");
      return;
    }
    // multiple → preview
    setPreview({ tasks: result.tasks, rawInputId: result.raw_input_id });
  };

  const createParsed = async (tasks: AIParsedTask[], rawInputId: string | null) => {
    let count = 0;
    for (const t of tasks) {
      const description = [
        t.description || "",
        t.next_action ? `Next: ${t.next_action}` : "",
        t.notes || "",
        t.person_name ? `Person: ${t.person_name}` : "",
        t.company_name ? `Company: ${t.company_name}` : "",
        t.job_title ? `Role: ${t.job_title}` : "",
      ].filter(Boolean).join("\n") || null;
      await m.create.mutateAsync({
        ...defaults,
        title: t.title.slice(0, 200),
        description,
        priority: t.priority || "medium",
        category: t.category || "admin",
        due_at: t.due_at ?? null,
        source: "ai_parser" as any,
        raw_input_id: rawInputId ?? undefined,
      } as any);
      count++;
    }
    toast.success(`${count} task${count === 1 ? "" : "s"} captured`);
  };

  const submit = async () => {
    if (!value.trim()) return;
    setSubmitting(true);
    setClarification(null);
    try {
      if (aiEnabled && aiAvailable && user) {
        try {
          await submitAI(value);
        } catch (e) {
          // fall back to regex
          await submitRegex();
        }
      } else {
        await submitRegex();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const acceptPreview = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      await createParsed(preview.tasks, preview.rawInputId);
      setPreview(null);
      setValue("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 p-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
        <Plus className="h-4 w-4 text-muted-foreground ml-1" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            placeholder ??
            (aiEnabled && aiAvailable
              ? "Add task in plain English… or use !high #networking today"
              : "Add task… use !high #networking today")
          }
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8"
        />
        <button
          type="button"
          onClick={toggleAi}
          className={cn(
            "h-7 px-2 rounded-md text-[10px] font-mono uppercase tracking-widest border flex items-center gap-1 transition-colors",
            aiEnabled && aiAvailable
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted/40 border-border text-muted-foreground hover:text-foreground",
          )}
          title={aiEnabled ? "AI parsing on. Click to switch to simple mode." : "Simple mode. Click to enable AI parsing."}
        >
          {aiEnabled && aiAvailable ? (
            <><Sparkles className="h-3 w-3" /> AI</>
          ) : (
            <><Zap className="h-3 w-3" /> Simple</>
          )}
        </button>
        <Button onClick={submit} size="sm" disabled={submitting || !value.trim()}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
      </div>

      {clarification && (
        <Card className="p-3 bg-surface-1 border-warning/30 text-sm">
          <div className="text-warning text-[10px] uppercase tracking-widest font-mono mb-1">
            Need clarification
          </div>
          <p className="text-foreground">{clarification}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Edit your message above with more detail and press Enter.
          </p>
        </Card>
      )}

      {preview && (
        <Card className="p-3 bg-surface-1 border-primary/30 space-y-2">
          <div className="text-primary text-[10px] uppercase tracking-widest font-mono">
            Preview · {preview.tasks.length} tasks
          </div>
          <ul className="space-y-1 text-sm">
            {preview.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground font-mono">{i + 1}.</span>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.priority} · {t.category}
                    {t.due_at ? ` · ${new Date(t.due_at).toLocaleString()}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={acceptPreview} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create all"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
