import { cn } from "@/lib/utils";

const sizeClasses: Record<string, string> = {
  sm: "min-h-[2.5rem] px-3 text-sm",
  md: "min-h-[3rem] px-4 text-base",
  lg: "min-h-[3.5rem] px-5 text-lg",
};

export function useFormClasses({
  size = "md",
  disabled = false,
  error = false,
  className = "",
}: any) {
  return cn(
    "appearance-none w-full rounded-md border transition-colors duration-200 outline-none shadow-sm",
    "bg-surface text-text placeholder:text-muted border-border",
    "focus:border-primary focus:ring-primary/20",
    error
      ? "border-danger text-danger focus:border-danger focus:ring-danger/20"
      : "",
    disabled && "bg-background opacity-60 cursor-not-allowed",
    sizeClasses[size] || sizeClasses.md,
    className,
  );
}
