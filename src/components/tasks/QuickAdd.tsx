import { useState, KeyboardEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTaskMutations } from "@/hooks/useTasks";
import { parseQuickAdd, TaskInsert } from "@/lib/tasks";
import { toast } from "sonner";

type Props = {
  defaults?: Partial<TaskInsert>;
  placeholder?: string;
};

export function QuickAdd({ defaults, placeholder }: Props) {
  const m = useTaskMutations();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = parseQuickAdd(value);
    if (!parsed.title) return;
    setSubmitting(true);
    try {
      await m.create.mutateAsync({
        ...defaults,
        title: parsed.title,
        priority: parsed.priority ?? defaults?.priority ?? "medium",
        category: parsed.category ?? defaults?.category ?? "admin",
        due_at: parsed.due_at ?? defaults?.due_at ?? null,
      });
      setValue("");
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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 p-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
      <Plus className="h-4 w-4 text-muted-foreground ml-1" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? "Add task… use !high #networking today"}
        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-8"
      />
      <Button onClick={submit} size="sm" disabled={submitting || !value.trim()}>
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
      </Button>
    </div>
  );
}
