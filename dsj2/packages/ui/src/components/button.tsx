import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const variants = {
  primary:
    "bg-[var(--surface-strong)] text-white hover:bg-[var(--surface-strong-hover)]",
  secondary:
    "border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-muted)]",
  subtle:
    "bg-[var(--accent-soft)] text-[var(--surface-strong)] hover:bg-[var(--accent-soft-hover)]",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center !rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
