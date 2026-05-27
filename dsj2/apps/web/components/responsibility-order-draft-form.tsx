import { Input, Select, Textarea } from "@dsj/ui";
import { responsibilityTypeLabels } from "../lib/labels";
import { ResponsibilityAppointmentPicker } from "./responsibility-appointment-picker";
import { SubmitButton } from "./submit-button";

type EmployeeOption = {
  id: string;
  fullName: string;
  employeeNumber: string;
  employeeKind: string;
  jobTitle: string;
  department?: { name: string } | null;
};

type ScopeOption = {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
};

type ResponsibilityOrderDraftFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Array<{ name: string; value: string | null | undefined }>;
  employees: EmployeeOption[];
  branches: ScopeOption[];
  departments: ScopeOption[];
  workSites: ScopeOption[];
  initialValues?: {
    number?: string;
    date?: string;
    responsibilityType?: string;
    title?: string;
    basis?: string;
    branchId?: string | null;
    departmentId?: string | null;
    workSiteId?: string | null;
    notes?: string | null;
    appointments?: Array<{
      employeeId: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      zoneOfResponsibility?: string | null;
      roleNotes?: string | null;
    }>;
    reason?: string | null;
  };
  replacementMode?: boolean;
  submitLabel: string;
  pendingLabel: string;
};

const responsibilityTypeOptions = Object.entries(responsibilityTypeLabels);

export function ResponsibilityOrderDraftForm({
  action,
  hiddenFields = [],
  employees,
  branches,
  departments,
  workSites,
  initialValues,
  replacementMode = false,
  submitLabel,
  pendingLabel,
}: ResponsibilityOrderDraftFormProps) {
  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
      ))}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Номер приказа</label>
        <Input
          name="number"
          defaultValue={initialValues?.number ?? ""}
          placeholder="ORD-RSP-2026-014"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Дата приказа</label>
        <Input
          name="date"
          type="date"
          defaultValue={initialValues?.date?.slice(0, 10) ?? ""}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Тип ответственности</label>
        <Select
          name="responsibilityType"
          defaultValue={initialValues?.responsibilityType ?? "OCCUPATIONAL_SAFETY_RESPONSIBLE"}
        >
          {responsibilityTypeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Заголовок / тема</label>
        <Input
          name="title"
          defaultValue={initialValues?.title ?? ""}
          placeholder="Назначение ответственных лиц"
          required
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Основание</label>
        <Input
          name="basis"
          defaultValue={initialValues?.basis ?? ""}
          placeholder="Внутреннее решение по охране труда и безопасности"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Область филиала</label>
        <Select name="branchId" defaultValue={initialValues?.branchId ?? ""}>
          <option value="">На уровне организации</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code ? `${branch.code} • ` : ""}
              {branch.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Область подразделения</label>
        <Select name="departmentId" defaultValue={initialValues?.departmentId ?? ""}>
          <option value="">Не выбрано</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Область объекта</label>
        <Select name="workSiteId" defaultValue={initialValues?.workSiteId ?? ""}>
          <option value="">Не выбрано</option>
          {workSites.map((workSite) => (
            <option key={workSite.id} value={workSite.id}>
              {workSite.name}
              {workSite.location ? ` (${workSite.location})` : ""}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500">
          Выберите только один уровень области. Оставьте все поля пустыми, если документ действует
          на уровне организации.
        </p>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-medium text-slate-700">Примечания</label>
        <Textarea
          name="notes"
          defaultValue={initialValues?.notes ?? ""}
          className="min-h-24"
          placeholder="Необязательные примечания о назначении, правовых основаниях или публикации."
        />
      </div>

      {replacementMode ? (
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Причина замены</label>
          <Textarea
            name="reason"
            defaultValue={
              initialValues?.reason ?? "Подписанный приказ о назначении заменяется новой редакцией."
            }
            className="min-h-24"
          />
        </div>
      ) : null}

      <div className="space-y-1.5 md:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700">Назначения</label>
          <p className="text-xs text-slate-500">
            Подписанные назначения станут основанием для карточки сотрудника и отображения в
            самообслуживании.
          </p>
        </div>
        <ResponsibilityAppointmentPicker
          employees={employees}
          initialAppointments={initialValues?.appointments ?? []}
          defaultEffectiveFrom={initialValues?.date ?? null}
        />
      </div>

      <div className="md:col-span-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
