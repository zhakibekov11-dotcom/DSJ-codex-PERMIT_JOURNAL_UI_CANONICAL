import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full !rounded-md border border-[var(--accent-border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--ink)] outline-none transition-colors duration-150 placeholder:text-[var(--muted)] focus:border-[var(--focus-border)] focus:ring-2 focus:ring-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}
