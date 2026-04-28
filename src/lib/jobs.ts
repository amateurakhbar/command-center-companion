import { Database } from "@/integrations/supabase/types";

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
export type JobStatus = Database["public"]["Enums"]["job_status"];
export type JobPriority = Database["public"]["Enums"]["priority"];

export const JOB_STATUSES: JobStatus[] = [
  "lead",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

export const JOB_PRIORITIES: JobPriority[] = ["high", "medium", "low"];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  lead: "Lead",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const JOB_PRIORITY_LABEL: Record<JobPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Pipeline order for grouping */
export const JOB_STATUS_ORDER: JobStatus[] = [
  "lead",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

export const OPEN_STATUSES: JobStatus[] = [
  "lead",
  "applied",
  "screening",
  "interview",
  "offer",
];

export const CLOSED_STATUSES: JobStatus[] = ["rejected", "withdrawn"];

export function isClosed(status: JobStatus) {
  return CLOSED_STATUSES.includes(status);
}

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
