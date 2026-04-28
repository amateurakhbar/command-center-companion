import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDeletedPeople, usePersonMutations } from "@/hooks/usePeople";
import {
  PersonStatusBadge,
  PersonPriorityDot,
  RelationshipBadge,
} from "./PersonBadges";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function PeopleTrashSheet({ open, onOpenChange }: Props) {
  const { data: deleted = [], isLoading } = useDeletedPeople();
  const m = usePersonMutations();

  const restore = async (id: string) => {
    try {
      await m.restorePerson.mutateAsync(id);
      toast.success("Person restored", {
        action: { label: "Undo", onClick: () => m.deletePerson.mutateAsync(id) },
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
            <Trash2 className="h-4 w-4" /> Deleted people
          </SheetTitle>
          <SheetDescription>Restore brings them back.</SheetDescription>
        </SheetHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deleted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-1/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">No deleted people.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {deleted.map((p) => (
                <li key={p.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <PersonPriorityDot priority={p.priority} className="mt-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{p.name}</span>
                      {p.company && <span className="text-xs text-muted-foreground truncate">· {p.company}</span>}
                      <RelationshipBadge type={p.relationship_type} />
                      <PersonStatusBadge status={p.status} />
                    </div>
                    {p.deleted_at && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Deleted {new Date(p.deleted_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(p.id)}>
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
