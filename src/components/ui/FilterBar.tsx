"use client";

import React from "react";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterGroupOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  value: string;
  options: FilterGroupOption[];
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  filters?: FilterGroup[];
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  className?: string;
  onResetFilters?: () => void;
}

export default function FilterBar({
  filters = [],
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search player name or tryout #...",
  className = "",
  onResetFilters,
}: FilterBarProps) {
  const hasActiveFilters = 
    (searchValue && searchValue.trim() !== "") || 
    filters.some(f => f.value !== "all" && f.value !== "");

  return (
    <div className={cn("flex flex-wrap items-center gap-3 bg-surface/80 border border-border p-3 rounded-2xl shadow-xs backdrop-blur-md", className)}>
      <div className="flex items-center gap-1.5 text-muted shrink-0">
        <Filter size={16} className="text-primary" />
        <span className="text-xs font-extrabold uppercase tracking-wider text-text">Filter:</span>
      </div>

      {/* Search Input */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-8 py-1.5 text-xs font-semibold text-text focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Select Dropdowns for Each Filter */}
      {filters.map((fg) => (
        <div key={fg.id} className="flex items-center gap-1.5">
          <label className="text-[10px] font-extrabold uppercase text-muted tracking-wider hidden sm:inline shrink-0">
            {fg.label}:
          </label>
          <select
            value={fg.value}
            onChange={(e) => fg.onChange(e.target.value)}
            className="bg-background border border-border text-xs font-bold text-text rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {fg.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Clear/Reset Button */}
      {hasActiveFilters && onResetFilters && (
        <button
          onClick={onResetFilters}
          className="text-xs font-bold text-muted hover:text-text flex items-center gap-1 bg-background border border-border px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ml-auto"
        >
          <X size={12} />
          <span>Clear Filters</span>
        </button>
      )}
    </div>
  );
}
