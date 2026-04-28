import { Sun } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function Today() {
  return (
    <PagePlaceholder
      icon={Sun}
      title="Today"
      description="Your command brief — what to ship, what's overdue, what's waiting."
      hint="Quick-add, sectioned task list, and end-of-day closeout will land in Phase 1B."
    />
  );
}
