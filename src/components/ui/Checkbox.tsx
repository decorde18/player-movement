import React from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: boolean;
  className?: string;
}

export default function Checkbox({
  label,
  checked,
  disabled = false,
  onChange,
  error = false,
  className = "",
}: CheckboxProps) {
  return (
    <label className={cn("inline-flex items-center align-middle leading-none gap-2 cursor-pointer select-none", label && "mb-2")}>
      <input
        type='checkbox'
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          "w-4 h-4 accent-purple-600 rounded border border-border focus:ring-0 cursor-pointer",
          disabled && "opacity-60 cursor-not-allowed",
          error && "border-danger",
          className
        )}
      />
      {label && (
        <span
          className={cn(
            "text-[var(--color-text-label)] text-[var(--font-size-small)]",
            error && "text-danger"
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
