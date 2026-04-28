import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function People() {
  return (
    <PagePlaceholder
      icon={Users}
      title="Networking Pipeline"
      description="Recruiters, referrals, alumni — who to message next."
      hint="Person list, follow-up scheduling, and job linking arrive in Phase 1B."
    />
  );
}
