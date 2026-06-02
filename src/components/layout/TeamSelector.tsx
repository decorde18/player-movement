"use client";
import Select from "@/components/ui/Select";

const defaultOptions = [
  { value: "", label: "All teams" },
  { value: "team-1", label: "First Team" },
  { value: "team-2", label: "Academy" },
];

function TeamSelector({
  type,
  onContextChange,
}: {
  type?: string;
  onContextChange?: (context: { teamSeasonId?: number } | null) => void;
}) {
  return (
    <div className='flex items-center justify-center'>
      <Select
        label={type === "header" ? undefined : "Team"}
        placeholder='Choose a team'
        options={defaultOptions}
        width='md'
        className='max-w-sm'
        onChange={(event: any) => {
          const value = event.target.value;
          if (onContextChange) {
            onContextChange(
              value
                ? { teamSeasonId: Number(value.replace(/[^0-9]/g, "")) }
                : null,
            );
          }
        }}
      />
    </div>
  );
}

export default TeamSelector;
