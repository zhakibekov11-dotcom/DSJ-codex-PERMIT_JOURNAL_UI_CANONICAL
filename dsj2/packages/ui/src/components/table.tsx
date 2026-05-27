import type { HTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function TableWrapper({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto !rounded-lg border border-[var(--line)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("min-w-full divide-y divide-[var(--line)] text-sm", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "bg-[var(--surface-muted)] px-4 py-3 text-left text-sm font-medium text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3.5 align-top text-[var(--ink)]", className)}
      {...props}
    />
  );
}
