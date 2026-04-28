import { ListTodo } from "lucide-react";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function Tasks() {
  return (
    <PagePlaceholder
      icon={ListTodo}
      title="Tasks"
      description="Every task you've captured. Filter, sort, bulk act."
      hint="Full table with filters, drawer editor, and bulk actions arrive in Phase 1B."
    />
  );
}
