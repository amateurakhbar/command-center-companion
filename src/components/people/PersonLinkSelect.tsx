import { usePeople } from "@/hooks/usePeople";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  filterByJobId?: string | null;
};

const NONE = "__none__";

export function PersonLinkSelect({ value, onChange, disabled, filterByJobId }: Props) {
  const { data: people = [], isLoading } = usePeople();
  const list = filterByJobId
    ? people.filter((p) => p.related_job_id === filterByJobId)
    : people;

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="No person" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>No person</SelectItem>
        {list.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.company ? ` · ${p.company}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
