import { Input, Select, Textarea } from "@dsj/ui";
import Link from "next/link";
import { BriefingParticipantPicker } from "./briefing-participant-picker";
import { SubmitButton } from "./submit-button";

type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
  employeeKind: string;
  contractorCompany?: { name: string } | null;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type WorkSiteOption = {
  id: string;
  name: string;
  location: string | null;
};

type ProtocolCommissionMemberValue = {
  fullName: string;
  jobTitle?: string | null;
};

type ProtocolDraftFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Array<{ name: string; value: string | null | undefined }>;
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  workSites: WorkSiteOption[];
  workSitesManageHref?: string;
  initialValues?: {
    number?: string;
    date?: string;
    protocolType?: string;
    basis?: string;
    departmentId?: string | null;
    workSiteId?: string | null;
    decision?: string;
    notes?: string | null;
    employeeIds?: string[];
    chairman?: ProtocolCommissionMemberValue | null;
    members?: ProtocolCommissionMemberValue[];
    reason?: string | null;
  };
  replacementMode?: boolean;
  submitLabel: string;
  pendingLabel: string;
};

export function ProtocolDraftForm({
  action,
  hiddenFields = [],
  employees,
  departments,
  workSites,
  workSitesManageHref,
  initialValues,
  replacementMode = false,
  submitLabel,
  pendingLabel,
}: ProtocolDraftFormProps) {
  const memberRows = Array.from(
    { length: Math.max(initialValues?.members?.length ?? 0, 2) },
    (_, index) => initialValues?.members?.[index] ?? { fullName: "", jobTitle: "" },
  );

  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
      ))}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Номер протокола</label>
        <Input
          name="number"
          defaultValue={initialValues?.number ?? ""}
          placeholder="PK-2026-014"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Дата протокола</label>
        <Input
          name="date"
          type="date"
          defaultValue={initialValues?.date?.slice(0, 10) ?? ""}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Вид протокола</label>
        <Input
          name="protocolType"
          defaultValue={initialValues?.protocolType ?? ""}
          placeholder="Проверка знаний"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подразделение</label>
        <Select name="departmentId" defaultValue={initialValues?.departmentId ?? ""}>
          <option value="">Не назначено</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Основание</label>
        <Input
          name="basis"
          defaultValue={initialValues?.basis ?? ""}
          placeholder="Заседание комиссии по ежегодной проверке допуска"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Объект / рабочая площадка</label>
        <Select name="workSiteId" defaultValue={initialValues?.workSiteId ?? ""}>
          <option value="">Не назначено</option>
          {workSites.map((workSite) => (
            <option key={workSite.id} value={workSite.id}>
              {workSite.name}
              {workSite.location ? ` (${workSite.location})` : ""}
            </option>
          ))}
        </Select>
        {!workSites.length && workSitesManageHref ? (
          <p className="text-xs text-amber-700">
            Справочник пуст.{" "}
            <Link href={workSitesManageHref} className="font-medium underline">
              Создать рабочую площадку
            </Link>
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Председатель</label>
        <Input
          name="chairmanFullName"
          defaultValue={initialValues?.chairman?.fullName ?? ""}
          placeholder="ФИО председателя"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Должность председателя</label>
        <Input
          name="chairmanJobTitle"
          defaultValue={initialValues?.chairman?.jobTitle ?? ""}
          placeholder="Должность председателя"
        />
      </div>

      <div className="space-y-3 md:col-span-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Члены комиссии</label>
          <p className="mt-1 text-xs text-slate-500">
            Заполняйте только нужные строки. Пустые строки игнорируются.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {memberRows.map((member, index) => (
            <div key={`member-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Член {index + 1}
              </p>
              <div className="mt-3 space-y-3">
                <Input
                  name="memberFullName"
                  defaultValue={member.fullName}
                  placeholder="ФИО члена комиссии"
                />
                <Input
                  name="memberJobTitle"
                  defaultValue={member.jobTitle ?? ""}
                  placeholder="Должность члена комиссии"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Решение / результат</label>
        <Textarea
          name="decision"
          defaultValue={initialValues?.decision ?? ""}
          className="min-h-28"
          placeholder="Укажите решение комиссии и его влияние на допуск."
          required
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Примечания</label>
        <Textarea
          name="notes"
          defaultValue={initialValues?.notes ?? ""}
          className="min-h-24"
          placeholder="Необязательные примечания или замечания."
        />
      </div>

      {replacementMode ? (
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Причина замены</label>
          <Textarea
            name="reason"
            defaultValue={initialValues?.reason ?? "Подписанный протокол заменяется новой редакцией."}
            className="min-h-24"
          />
        </div>
      ) : null}

      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700">Сотрудники по протоколу</label>
          <p className="text-xs text-slate-500">
            Подписанный протокол повлияет на карточки этих сотрудников и результаты комплаенса.
          </p>
        </div>
        <BriefingParticipantPicker
          employees={employees}
          initialEmployeeIds={initialValues?.employeeIds ?? []}
          availableTitle="Добавить сотрудников"
          availableDescription="Ищите по ФИО, табельному номеру, типу сотрудника или подрядной компании."
          availableEmptyState="Сотрудники не найдены."
          selectedTitle="Выбранные сотрудники"
          selectedDescription="Эти сотрудники будут привязаны к протоколу и перерасчету комплаенса."
          selectedEmptyState="Выберите хотя бы одного сотрудника для этого протокола."
          searchPlaceholder="Найти сотрудника"
        />
      </div>

      <div className="md:col-span-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
