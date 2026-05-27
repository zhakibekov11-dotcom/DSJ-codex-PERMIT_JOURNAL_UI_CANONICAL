"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@dsj/ui";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "subtle" | "danger";
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  className,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      className={className}
    >
      {pending ? (pendingLabel ?? "Сохранение...") : label}
    </Button>
  );
}
