"use client";

import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

export interface SortOption {
  value: string;
  label: string;
}

export interface SortControlProps {
  options: SortOption[];
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSortChange: (key: string, direction: "asc" | "desc") => void;
  label?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export default function SortControl({
  options,
  sortKey,
  sortDirection,
  onSortChange,
  label = "Sort by",
  size = "sm",
  className = "",
}: SortControlProps) {
  const toggleDirection = () => {
    onSortChange(sortKey, sortDirection === "asc" ? "desc" : "asc");
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value, sortDirection);
  };

  const sizeClasses = {
    xs: "text-[10px] py-1 px-2 h-7",
    sm: "text-xs py-1.5 px-3 h-9",
    md: "text-sm py-2 px-3 h-10",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 bg-surface/80 border border-border rounded-xl p-1 shadow-xs", className)}>
      {label && (
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted px-2 shrink-0">
          {label}
        </span>
      )}
      
      <select
        value={sortKey}
        onChange={handleKeyChange}
        className={cn(
          "bg-background font-bold text-text border border-border rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary",
          sizeClasses[size]
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <Button
        variant="outline"
        size={size === "xs" ? "xs" : "sm"}
        onClick={toggleDirection}
        title={sortDirection === "asc" ? "Sort Ascending (Click to switch to Descending)" : "Sort Descending (Click to switch to Ascending)"}
        className={cn(
          "flex items-center gap-1 font-bold text-muted hover:text-text cursor-pointer border-border hover:bg-background transition-all shrink-0",
          size === "xs" ? "h-7 px-2" : "h-9 px-2.5"
        )}
      >
        {sortDirection === "asc" ? (
          <>
            <ArrowUp size={size === "xs" ? 12 : 14} className="text-primary" />
            <span className="text-[10px] font-extrabold uppercase hidden sm:inline">Asc (A-Z / 1-10)</span>
          </>
        ) : (
          <>
            <ArrowDown size={size === "xs" ? 12 : 14} className="text-accent" />
            <span className="text-[10px] font-extrabold uppercase hidden sm:inline">Desc (Z-A / 10-1)</span>
          </>
        )}
      </Button>
    </div>
  );
}
