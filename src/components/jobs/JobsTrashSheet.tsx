import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDeletedJobs, useJobMutations } from "@/hooks/useJobs";
import { JobStatusBadge, JobPriorityDot } from "./JobBadges";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function JobsTrashSheet({ open, onOpenChange }: Props) {
  const { data: deleted = [], isLoading } = useDeletedJobs();
  const m = useJobMutations();

  const restore = async (id: string) => {
    try {
      await m.restoreJob.mutateAsync(id);
      toast.success("Job restored", {
        action: {
          label: "Undo",
          onClick: () => m.deleteJob.mutateAsync(id),
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
            <Trash2 className="h-4 w-4" /> Deleted jobs
          </SheetTitle>
          <SheetDescription>Restore brings them back to the pipeline.</SheetDescription>
        </SheetHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deleted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-1/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">No deleted jobs.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {deleted.map((j) => (
                <li
                  key={j.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                >
                  <JobPriorityDot priority={j.priority} className="mt-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{j.company}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm truncate">{j.role_title}</span>
                      <JobStatusBadge status={j.status} />
                    </div>
                    {j.deleted_at && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Deleted {new Date(j.deleted_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(j.id)}>
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
