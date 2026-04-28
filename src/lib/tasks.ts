import { Database } from "@/integrations/supabase/types";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskCategory = Database["public"]["Enums"]["task_category"];
export type TaskPriority = Database["public"]["Enums"]["priority"];

export const TASK_STATUSES: TaskStatus[] = ["to_do", "in_progress", "waiting", "done", "killed"];
export const TASK_CATEGORIES: TaskCategory[] = [
  "job_application",
  "networking",
  "follow_up",
  "meeting",
  "interview_prep",
  "admin",
  "personal",
];
export const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  to_do: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
  killed: "Killed",
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  job_application: "Application",
  networking: "Networking",
  follow_up: "Follow-up",
  meeting: "Meeting",
  interview_prep: "Interview prep",
  admin: "Admin",
  personal: "Personal",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/* ---------- Quick-add parser ---------- */

const PRIORITY_TOKENS: Record<string, TaskPriority> = {
  "!high": "high",
  "!h": "high",
  "!med": "medium",
  "!medium": "medium",
  "!m": "medium",
  "!low": "low",
  "!l": "low",
};

const CATEGORY_TOKENS: Record<string, TaskCategory> = {
  "#app": "job_application",
  "#application": "job_application",
  "#job": "job_application",
  "#net": "networking",
  "#networking": "networking",
  "#followup": "follow_up",
  "#follow-up": "follow_up",
  "#meeting": "meeting",
  "#prep": "interview_prep",
  "#interview": "interview_prep",
  "#admin": "admin",
  "#personal": "personal",
};

export type ParsedQuickAdd = {
  title: string;
  priority?: TaskPriority;
  category?: TaskCategory;
  due_at?: string | null;
};

export function parseQuickAdd(input: string): ParsedQuickAdd {
  let priority: TaskPriority | undefined;
  let category: TaskCategory | undefined;
  let due_at: string | null | undefined;

  const tokens = input.split(/\s+/);
  const remaining: string[] = [];

  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (PRIORITY_TOKENS[t]) {
      priority = PRIORITY_TOKENS[t];
      continue;
    }
    if (CATEGORY_TOKENS[t]) {
      category = CATEGORY_TOKENS[t];
      continue;
    }
    if (t === "today" || t === "@today") {
      due_at = endOfDayISO(new Date());
      continue;
    }
    if (t === "tomorrow" || t === "@tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      due_at = endOfDayISO(d);
      continue;
    }
    remaining.push(raw);
  }

  return {
    title: remaining.join(" ").trim(),
    priority,
    category,
    due_at,
  };
}

function endOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 0, 0);
  return x.toISOString();
}

/* ---------- Date helpers ---------- */

export function isDueToday(due_at: string | null): boolean {
  if (!due_at) return false;
  const d = new Date(due_at);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isOverdue(due_at: string | null): boolean {
  if (!due_at) return false;
  return new Date(due_at).getTime() < Date.now();
}

export function relativeDue(due_at: string | null): string {
  if (!due_at) return "No due date";
  const d = new Date(due_at);
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  if (abs < 60) return diffMin >= 0 ? `in ${abs}m` : `${abs}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH >= 0 ? `in ${diffH}h` : `${Math.abs(diffH)}h ago`;
  const diffD = Math.round(diffH / 24);
  return diffD >= 0 ? `in ${diffD}d` : `${Math.abs(diffD)}d ago`;
}
