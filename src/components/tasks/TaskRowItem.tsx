import { MoreHorizontal, Check, Clock, Skull, Hourglass, Split, RotateCcw, Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskRow, isOverdue, isDueToday, relativeDue } from "@/lib/tasks";
import { StatusBadge, PriorityDot, CategoryBadge } from "./TaskBadges";
import { useTaskActionToasts } from "@/hooks/useTaskActions";
import { cn } from "@/lib/utils";

type Props = {
  task: TaskRow;
  onOpen: (task: TaskRow) => void;
  onBreakDown?: (task: TaskRow) => void;
  onKill?: (task: TaskRow) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (next: boolean) => void;
  showLinkedIndicators?: boolean;
};

export function TaskRowItem({
  task,
  onOpen,
  onBreakDown,
  onKill,
  selectable,
  selected,
  onSelectChange,
  showLinkedIndicators = true,
}: Props) {
  const actions = useTaskActionToasts();
  const overdue = isOverdue(task.due_at) && task.status !== "done" && task.status !== "killed";
  const today = isDueToday(task.due_at);
  const isDone = task.status === "done";
  const isKilled = task.status === "killed";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5 transition-colors hover:bg-surface-2",
        (isDone || isKilled) && "opacity-60"
      )}
    >
      {selectable && (
        <Checkbox
          checked={!!selected}
          onCheckedChange={(v) => onSelectChange?.(!!v)}
          className="mt-1"
          aria-label="Select task"
        />
      )}

      <button
        onClick={() => actions.done(task)}
        disabled={isDone || isKilled}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded-md border border-border flex items-center justify-center transition-colors",
          isDone ? "bg-success/20 border-success/40 text-success" : "hover:border-primary/60 hover:bg-primary/10"
        )}
        aria-label="Mark done"
        title="Mark done"
      >
        {isDone && <Check className="h-3.5 w-3.5" />}
      </button>

      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityDot priority={task.priority} />
          <span className={cn("text-sm font-medium truncate", isDone && "line-through")}>{task.title}</span>
          <StatusBadge status={task.status} />
          <CategoryBadge category={task.category} />
          {(task.delay_count ?? 0) > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
              title={`Delayed ${task.delay_count} time${task.delay_count === 1 ? "" : "s"}`}
            >
              <Clock className="h-2.5 w-2.5" />
              {task.delay_count}
            </span>
          )}
          {showLinkedIndicators && task.related_job_id && (
            <Briefcase className="h-3 w-3 text-muted-foreground" />
          )}
          {showLinkedIndicators && task.related_person_id && (
            <Users className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span
            className={cn(
              overdue && "text-destructive font-medium",
              today && !overdue && "text-warning font-medium"
            )}
          >
            {relativeDue(task.due_at)}
          </span>
          {task.parent_task_id && <span>· subtask</span>}
        </div>
      </button>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Task actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isDone && !isKilled && (
              <>
                <DropdownMenuItem onClick={() => actions.done(task)}>
                  <Check className="mr-2 h-4 w-4" /> Mark done
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.delay(task, 1, "Delayed 1h")}>
                  <Clock className="mr-2 h-4 w-4" /> Delay 1h
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.delay(task, 24, "Delayed 1d")}>
                  <Clock className="mr-2 h-4 w-4" /> Delay 1d
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.waiting(task)}>
                  <Hourglass className="mr-2 h-4 w-4" /> Mark waiting
                </DropdownMenuItem>
                {onBreakDown && (
                  <DropdownMenuItem onClick={() => onBreakDown(task)}>
                    <Split className="mr-2 h-4 w-4" /> Break down
                  </DropdownMenuItem>
                )}
                {onKill && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onKill(task)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Skull className="mr-2 h-4 w-4" /> Kill…
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
            {(isDone || isKilled) && (
              <DropdownMenuItem onClick={() => actions.reopen(task)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reopen
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
