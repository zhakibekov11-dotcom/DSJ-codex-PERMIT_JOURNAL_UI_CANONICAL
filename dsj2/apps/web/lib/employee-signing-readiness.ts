export type EmployeeSigningReadinessInput = {
  hasAccount?: boolean;
  accountRole?: string | null;
  hasEmployeeSignerAccount?: boolean;
};

export type EmployeeSigningReadiness =
  | {
      key: "ready";
      label: "Готов к подписи";
      className: string;
    }
  | {
      key: "missing-account";
      label: "Кабинет не создан";
      className: string;
    }
  | {
      key: "wrong-account";
      label: "Текущий кабинет не является кабинетом сотрудника";
      className: string;
    };

export function getEmployeeSigningReadiness(
  employee: EmployeeSigningReadinessInput,
): EmployeeSigningReadiness {
  if (employee.hasEmployeeSignerAccount === true) {
    return {
      key: "ready",
      label: "Готов к подписи",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  }

  if (!employee.hasAccount && !employee.accountRole) {
    return {
      key: "missing-account",
      label: "Кабинет не создан",
      className: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }

  return {
    key: "wrong-account",
    label: "Текущий кабинет не является кабинетом сотрудника",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  };
}
