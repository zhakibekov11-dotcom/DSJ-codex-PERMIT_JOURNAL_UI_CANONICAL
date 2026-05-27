import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function EmptyState({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-center justify-center !rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-6 py-10 text-center text-sm text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
