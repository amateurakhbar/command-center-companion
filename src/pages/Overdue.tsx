import { AlertTriangle } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function Overdue() {
  return (
    <PagePlaceholder
      icon={AlertTriangle}
      title="Overdue"
      description="Anything past due that isn't done or killed. Triage zone."
      hint="Triage UI ships in Phase 1B alongside task actions."
    />
  );
}
