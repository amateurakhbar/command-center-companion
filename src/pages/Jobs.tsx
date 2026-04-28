import { Briefcase } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function Jobs() {
  return (
    <PagePlaceholder
      icon={Briefcase}
      title="Job Pipeline"
      description="Companies, roles, status, and next move."
      hint="Job list, drawer editor, and status grouping arrive in Phase 1B."
    />
  );
}
