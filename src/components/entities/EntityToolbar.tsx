"use client";

import { Search } from "lucide-react";
import Select from "@/components/ui/Select";

interface EntityToolbarProps {
  plural: string;
  count: number;
  globalFilter: string;
  onGlobalFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  statusOptions: string[];
  singular: string;
}

export function EntityToolbar({
  plural,
  count,
  globalFilter,
  onGlobalFilterChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  singular,
}: EntityToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60"
        />
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          placeholder={`Search ${plural.toLowerCase()}...`}
          className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-xl bg-surface text-text placeholder:text-muted/60 focus:outline-none focus:border-border focus:ring-2 focus:ring-primary/10 transition-colors"
        />
      </div>

      {/* Status filter */}
      {statusOptions.length > 0 && (
        <Select
          value={statusFilter}
          onChange={(e: any) => onStatusFilterChange(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            ...statusOptions.map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
            })),
          ]}
          showPlaceholder={false}
          className="min-w-[140px]"
        />
      )}

      {/* Row count */}
      <span className="ml-auto text-xs text-muted">
        {count} {count === 1 ? singular.toLowerCase() : plural.toLowerCase()}
      </span>
    </div>
  );
}