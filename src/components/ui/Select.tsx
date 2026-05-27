/**
 * Select Component - Uses Global Theme Variables
 * 
 * @example
 * // Basic usage with string options
 * <Select
 *   label="Team"
 *   placeholder="Select a team"
 *   options={["Team A", "Team B", "Team C"]}
 *   width="md"
 * />
 * 
 * @example
 * // With object options (value/label pairs)
 * <Select
 *   label="League"
 *   placeholder="Choose a league"
 *   options={[
 *     { value: "prem", label: "Premier League" },
 *     { value: "championship", label: "Championship" }
 *   ]}
 *   width="lg"
 *   onChange={(e) => console.log(e.target.value)}
 * />
 * 
 * @example
 * // Error state with disabled option
 * <Select
 *   label="Status"
 *   options={["Active", "Inactive"]}
 *   error={true}
 *   disabled={false}
 *   width="sm"
 * />
 */

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "options"
  > {
  label?: string;
  options: (string | SelectOption)[];
  error?: boolean;
  width?: "auto" | "sm" | "md" | "lg" | "full";
  placeholder?: string;
  showPlaceholder?: boolean;
}

export default function Select({
  label,
  options = [],
  disabled = false,
  error = false,
  className = "",
  width = "auto", // "auto", "sm", "md", "lg", "full"
  placeholder = "Select an option",
  showPlaceholder = true,
  defaultValue,
  ...props
}: SelectProps) {
  const widthClasses: Record<string, string> = {
    auto: "w-auto",
    sm: "w-48",
    md: "w-64",
    lg: "w-80",
    full: "w-full",
  };

  return (
    <div className={cn("relative", widthClasses[width])}>
      <div className='relative'>
        <select
          disabled={disabled}
          defaultValue={defaultValue}
          className={cn(
            "appearance-none w-full px-4 py-2 rounded-md transition-colors border",
            "text-sm font-semibold",
            "cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            error
              ? "bg-danger/10 hover:bg-danger/20 border-danger text-danger"
              : "bg-surface hover:bg-white/80 border-border",
            label && "pt-5 pb-2",
            className,
          )}
          {...props}
        >
          {showPlaceholder && (
            <option value='' disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt: any, i: number) => {
            const isObj = typeof opt === "object" && opt !== null;
            return (
              <option key={i} value={isObj ? opt.value : opt}>
                {isObj ? opt.label : opt}
              </option>
            );
          })}
        </select>

        {label && (
          <label className='absolute left-4 top-1.5 text-xs text-text-label pointer-events-none'>
            {label}
          </label>
        )}

        <ChevronDown
          size={16}
          className='absolute right-4 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none'
        />
      </div>
    </div>
  );
}
