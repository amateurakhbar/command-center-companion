import { MoreHorizontal, MessageCircle, Reply, CalendarClock, Hourglass, MoonStar, XCircle, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonRow, relativeDate } from "@/lib/people";
import {
  PersonStatusBadge,
  PersonPriorityDot,
  RelationshipBadge,
  StrengthMeter,
} from "./PersonBadges";
import { cn } from "@/lib/utils";

type Props = {
  person: PersonRow;
  onOpen: (p: PersonRow) => void;
  onContacted?: (p: PersonRow) => void;
  onReplied?: (p: PersonRow) => void;
  onScheduleFollowUp?: (p: PersonRow) => void;
  onWaiting?: (p: PersonRow) => void;
  onDormant?: (p: PersonRow) => void;
  onClosed?: (p: PersonRow) => void;
  onDelete?: (p: PersonRow) => void;
};

export function PersonRowItem({
  person,
  onOpen,
  onContacted,
  onReplied,
  onScheduleFollowUp,
  onWaiting,
  onDormant,
  onClosed,
  onDelete,
}: Props) {
  const isClosed = person.status === "closed" || person.status === "dormant";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5 transition-colors hover:bg-surface-2",
        isClosed && "opacity-60"
      )}
    >
      <PersonPriorityDot priority={person.priority} className="mt-2 shrink-0" />

      <button onClick={() => onOpen(person)} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{person.name}</span>
          {(person.company || person.role_title) && (
            <span className="text-xs text-muted-foreground truncate">
              {person.role_title}
              {person.role_title && person.company ? " · " : ""}
              {person.company}
            </span>
          )}
          <RelationshipBadge type={person.relationship_type} />
          <PersonStatusBadge status={person.status} />
          {person.relationship_strength != null && (
            <StrengthMeter value={person.relationship_strength} />
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
          {person.next_follow_up_at && (
            <span className="inline-flex items-center gap-1 text-warning">
              <CalendarClock className="h-3 w-3" />
              Follow-up {relativeDate(person.next_follow_up_at)}
            </span>
          )}
          {person.last_contacted_at && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              Last contact {relativeDate(person.last_contacted_at)}
            </span>
          )}
          {person.linkedin_url && (
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> LinkedIn
            </span>
          )}
        </div>
      </button>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Person actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onContacted && (
              <DropdownMenuItem onClick={() => onContacted(person)}>
                <MessageCircle className="mr-2 h-4 w-4" /> Mark contacted
              </DropdownMenuItem>
            )}
            {onReplied && (
              <DropdownMenuItem onClick={() => onReplied(person)}>
                <Reply className="mr-2 h-4 w-4" /> Mark replied
              </DropdownMenuItem>
            )}
            {onScheduleFollowUp && (
              <DropdownMenuItem onClick={() => onScheduleFollowUp(person)}>
                <CalendarClock className="mr-2 h-4 w-4" /> Schedule follow-up
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onWaiting && (
              <DropdownMenuItem onClick={() => onWaiting(person)}>
                <Hourglass className="mr-2 h-4 w-4" /> Mark waiting
              </DropdownMenuItem>
            )}
            {onDormant && (
              <DropdownMenuItem onClick={() => onDormant(person)}>
                <MoonStar className="mr-2 h-4 w-4" /> Mark dormant
              </DropdownMenuItem>
            )}
            {onClosed && (
              <DropdownMenuItem onClick={() => onClosed(person)}>
                <XCircle className="mr-2 h-4 w-4" /> Mark closed
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(person)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
