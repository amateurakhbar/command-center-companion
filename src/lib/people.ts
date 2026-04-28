import { Database } from "@/integrations/supabase/types";

export type PersonRow = Database["public"]["Tables"]["people"]["Row"];
export type PersonInsert = Database["public"]["Tables"]["people"]["Insert"];
export type PersonUpdate = Database["public"]["Tables"]["people"]["Update"];
export type PersonStatus = Database["public"]["Enums"]["person_status"];
export type RelationshipType = Database["public"]["Enums"]["relationship_type"];
export type PersonPriority = Database["public"]["Enums"]["priority"];

export const PERSON_STATUSES: PersonStatus[] = [
  "to_contact",
  "contacted",
  "replied",
  "meeting_booked",
  "follow_up_due",
  "waiting",
  "dormant",
  "closed",
];

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "recruiter",
  "hiring_manager",
  "referral",
  "alumni",
  "friend",
  "investor",
  "operator",
  "other",
];

export const PERSON_PRIORITIES: PersonPriority[] = ["high", "medium", "low"];

export const PERSON_STATUS_LABEL: Record<PersonStatus, string> = {
  to_contact: "To contact",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  follow_up_due: "Follow-up due",
  waiting: "Waiting",
  dormant: "Dormant",
  closed: "Closed",
};

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  referral: "Referral",
  alumni: "Alumni",
  friend: "Friend",
  investor: "Investor",
  operator: "Operator",
  other: "Other",
};

export const PERSON_PRIORITY_LABEL: Record<PersonPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PERSON_STATUS_ORDER: PersonStatus[] = PERSON_STATUSES;

export type PersonSort =
  | "next_follow_up_at"
  | "last_contacted_at"
  | "priority"
  | "created_at";

export const PERSON_SORT_LABEL: Record<PersonSort, string> = {
  next_follow_up_at: "Next follow-up",
  last_contacted_at: "Last contacted",
  priority: "Priority",
  created_at: "Recently added",
};

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  if (abs < 60) return diffMin >= 0 ? `in ${abs}m` : `${abs}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH >= 0 ? `in ${diffH}h` : `${Math.abs(diffH)}h ago`;
  const diffD = Math.round(diffH / 24);
  return diffD >= 0 ? `in ${diffD}d` : `${Math.abs(diffD)}d ago`;
}
