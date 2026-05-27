"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@dsj/ui";

export function DeleteCompanyButton({ companyName }: { companyName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      onClick={(event) => {
        if (
          !window.confirm(
            `Удалить компанию «${companyName}»? Это уберёт сотрудников, журналы, удостоверения и связанные данные.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      disabled={pending}
    >
      {pending ? "Удаление..." : "Удалить"}
    </Button>
  );
}
