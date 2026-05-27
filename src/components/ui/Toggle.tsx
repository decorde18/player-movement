"use client";
import React from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

export interface ToggleProps {
  label?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export default function Toggle({
  label,
  checked,
  disabled = false,
  onChange,
  className = "",
}: ToggleProps) {
  return (
    <div className='flex items-center gap-3'>
      <Button
        variant={checked ? "primary" : "outline"}
        size='xs'
        onClick={() => !disabled && onChange && onChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative w-12 p-0 m-2 h-[24px] rounded-full transition-colors duration-300 overflow-hidden",
          disabled && "opacity-60 cursor-not-allowed",
          className,
        )}
      >
        <span
          className={cn(
            "absolute top-[1px] left-[1px] h-5 w-5 rounded-full bg-surface transition-transform duration-300 shadow-sm",
            checked && "translate-x-[24px]",
          )}
        />
      </Button>

      {label && <span className='text-sm text-text-label'>{label}</span>}
    </div>
  );
}
