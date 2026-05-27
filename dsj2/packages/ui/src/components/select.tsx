import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full !rounded-md border border-[var(--accent-border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--ink)] outline-none transition-colors duration-150 focus:border-[var(--focus-border)] focus:ring-2 focus:ring-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}
