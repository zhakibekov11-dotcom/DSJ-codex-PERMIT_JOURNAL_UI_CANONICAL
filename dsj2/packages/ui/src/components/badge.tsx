import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const tones = {
  slate: "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--muted)]",
  blue: "border-[var(--accent-border)] bg-[var(--surface)] text-[var(--surface-strong)]",
  green: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--surface-strong)]",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

type BadgeTone = keyof typeof tones;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
