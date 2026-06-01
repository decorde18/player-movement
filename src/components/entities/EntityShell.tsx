import { EntityPage } from "@/components/entities/EntityPage";
import type { EntityConfig } from "@/components/entities/types";

interface EntityShellProps<T extends Record<string, unknown>> {
  config: EntityConfig;
  data: T[];
  stats?: { label: string; value: number | string }[];
  onCreate: (data: Record<string, string>) => Promise<void>;
  onUpdate: (id: unknown, data: Record<string, string>) => Promise<void>;
  onDelete: (id: unknown) => Promise<void>;
}

export async function EntityShell<T extends Record<string, unknown>>({
  config,
  data,
  stats,
  onCreate,
  onUpdate,
  onDelete,
}: EntityShellProps<T>) {
  return (
    <EntityPage
      config={config}
      data={data}
      stats={stats}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}
