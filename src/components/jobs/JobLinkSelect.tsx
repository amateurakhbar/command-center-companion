import { useJobs } from "@/hooks/useJobs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
};

const NONE = "__none__";

export function JobLinkSelect({ value, onChange, disabled }: Props) {
  const { data: jobs = [], isLoading } = useJobs();

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="No job" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>No job</SelectItem>
        {jobs.map((j) => (
          <SelectItem key={j.id} value={j.id}>
            {j.company} · {j.role_title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
