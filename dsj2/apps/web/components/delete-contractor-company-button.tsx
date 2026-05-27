"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@dsj/ui";

export function DeleteContractorCompanyButton({
  companyName,
}: {
  companyName: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      onClick={(event) => {
        if (
          !window.confirm(
            `Удалить подрядную организацию «${companyName}»? Сотрудники останутся в системе, но отвяжутся от этой организации.`,
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
