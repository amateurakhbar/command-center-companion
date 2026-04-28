import { BarChart3 } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function Score() {
  return (
    <PagePlaceholder
      icon={BarChart3}
      title="Execution Score"
      description="Daily score, 7-day trend, and what's stalling you."
      hint="Score computation and sparkline arrive in Phase 1B."
    />
  );
}
