/**
 * Button Component - Uses Global Theme Variables
 * 
 * @example
 * // Primary button (default)
 * <Button variant="primary" size="md">Click me</Button>
 * 
 * @example
 * // Various variants
 * <Button variant="success">Success</Button>
 * <Button variant="danger">Delete</Button>
 * <Button variant="outline">Cancel</Button>
 * <Button variant="secondary">Secondary</Button>
 * 
 * @example
 * // Different sizes
 * <Button size="xs">Tiny</Button>
 * <Button size="sm">Small</Button>
 * <Button size="md">Medium</Button>
 * <Button size="lg">Large</Button>
 * 
 * @example
 * // Disabled state
 * <Button disabled>Disabled</Button>
 */

"use client";
import { cn } from "@/lib/utils";
import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "success"
    | "muted"
    | "outline"
    | "danger"
    | "secondary";
  size?: "xs" | "sm" | "md" | "lg";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex flex-col items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95 mb-0 select-none shadow-sm";
  const sizes: Record<string, string> = {
    xs: "text-[0.7rem] px-1.5 py-0.5",

    sm: "text-xs px-2 py-1",
    md: "text-base px-4 py-2",
    lg: "text-lg px-6 py-3",
  };

  const variants: Record<string, string> = {
    primary: "bg-primary text-white hover:bg-accent-hover shadow-primary/20",
    success: "bg-success text-white hover:opacity-90 shadow-success/20",
    muted: "bg-muted text-white cursor-not-allowed border-none",
    outline: "border-2 border-border text-text hover:bg-background",
    danger: "border border-border bg-danger text-white hover:opacity-90",
    secondary: "bg-secondary text-white hover:opacity-90",
  };

  return (
    <button
      disabled={disabled}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
