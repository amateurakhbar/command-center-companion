import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDeletedTasks, useTaskMutations } from "@/hooks/useTasks";
import { TaskRow } from "@/lib/tasks";
import { StatusBadge, PriorityDot, CategoryBadge } from "./TaskBadges";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function TrashSheet({ open, onOpenChange }: Props) {
  const { data: deleted = [], isLoading } = useDeletedTasks();
  const m = useTaskMutations();

  const restore = async (t: TaskRow) => {
    try {
      await m.update.mutateAsync({ id: t.id, patch: { deleted_at: null } });
      toast.success("Restored", {
        action: {
          label: "Undo",
          onClick: () => m.softDelete.mutateAsync(t.id),
        },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-surface-1 border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Trash
          </SheetTitle>
          <SheetDescription>
            Soft-deleted tasks. Restore brings them back to the active list.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deleted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-1/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Trash is empty.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {deleted.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PriorityDot priority={t.priority} />
                      <span className="text-sm font-medium truncate">{t.title}</span>
                      <StatusBadge status={t.status} />
                      <CategoryBadge category={t.category} />
                    </div>
                    {t.deleted_at && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Deleted {new Date(t.deleted_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(t)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
