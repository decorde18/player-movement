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
    <label className='flex items-center gap-2 cursor-pointer mb-2'>
      <input
        type='checkbox'
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          "w-5 h-5 accent-primary rounded-[var(--radius-sm)] border border-border",
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
