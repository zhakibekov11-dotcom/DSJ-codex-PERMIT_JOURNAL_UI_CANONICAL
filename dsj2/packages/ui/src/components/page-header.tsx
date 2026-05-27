import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function PageHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between",
        "[&>div:first-child]:min-w-0 [&>div:first-child]:space-y-2",
        "[&>div:first-child>p:first-child]:hidden",
        "[&>div:first-child>h1]:mt-0 [&>div:first-child>h1]:text-[2rem] [&>div:first-child>h1]:font-semibold [&>div:first-child>h1]:leading-tight [&>div:first-child>h1]:tracking-[-0.02em] [&>div:first-child>h2]:mt-0",
        "[&>div:first-child>p]:m-0 [&>div:first-child>p]:max-w-3xl [&>div:first-child>p]:text-sm [&>div:first-child>p]:leading-6 [&>div:first-child>p]:text-[var(--muted)]",
        "[&>div:last-child]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
