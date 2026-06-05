import { Input, Select, Textarea } from "@dsj/ui";
import Link from "next/link";
import {
  getPermitTypeLabel,
  getPermitWorkTypeLabel,
  legalBasisOptions,
  mvpPermitTypeOptions,
  mvpPermitWorkTypeOptions,
  type PermitEntry,
  type PermitOption,
} from "@/lib/permits";
import { SubmitButton } from "./submit-button";

type PermitEntryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{ name: string; value: string | null | undefined }>;
  employees: PermitOption[];
  departments: PermitOption[];
  workSites: PermitOption[];
  workSitesManageHref?: string;
  contractors: PermitOption[];
  initialValues?: PermitEntry | null;
  submitLabel: string;
  pendingLabel: string;
  locked?: boolean;
};

function isSelected(values: string[] | undefined, value: string) {
  return values?.includes(value) ?? false;
}

function evidenceText(values: string[] | undefined) {
  return values?.join("\n") ?? "";
}

export function PermitEntryForm({
  action,
  hiddenFields,
  employees,
  departments,
  workSites,
  workSitesManageHref,
  contractors,
  initialValues,
  submitLabel,
  pendingLabel,
  locked = false,
}: PermitEntryFormProps) {
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value ?? ""} />
      ))}
      <input type="hidden" name="createdAt" value={initialValues?.createdAt ?? ""} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">№ наряда-допуска</label>
        <Input
          name="permitNumber"
          defaultValue={initialValues?.permitNumber ?? ""}
          placeholder="WP-2026-001"
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">№ записи в журнале</label>
        <Input
          name="journalRegistrationNumber"
          defaultValue={initialValues?.journalRegistrationNumber ?? ""}
          placeholder="PJ-0001"
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Тип допуска</label>
        <Select
          name="permitType"
          defaultValue={initialValues?.permitType ?? "HIGH_RISK_WORK"}
          disabled={locked}
        >
          {mvpPermitTypeOptions.map((value) => (
            <option key={value} value={value}>
              {getPermitTypeLabel(value)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Вид работ</label>
        <Select
          name="workType"
          defaultValue={initialValues?.workType ?? "GENERAL_HIGH_RISK"}
          disabled={locked}
        >
          {mvpPermitWorkTypeOptions.map((value) => (
            <option key={value} value={value}>
              {getPermitWorkTypeLabel(value)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подразделение</label>
        <Select name="departmentId" defaultValue={initialValues?.departmentId ?? ""} disabled={locked}>
          <option value="">Не выбрано</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Зона / объект работ</label>
        <Select name="workSiteId" defaultValue={initialValues?.workZoneId ?? ""} disabled={locked}>
          <option value="">Не выбрано</option>
          {workSites.map((workSite) => (
            <option key={workSite.id} value={workSite.id}>
              {workSite.label}
              {workSite.sublabel ? ` (${workSite.sublabel})` : ""}
            </option>
          ))}
        </Select>
        {!locked && !workSites.length && workSitesManageHref ? (
          <p className="text-xs text-amber-700">
            Справочник пуст.{" "}
            <Link href={workSitesManageHref} className="font-medium underline">
              Создать рабочую площадку
            </Link>
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Дата и время начала</label>
        <Input
          name="startAt"
          type="datetime-local"
          defaultValue={initialValues?.startAt?.slice(0, 16) ?? ""}
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Дата и время окончания</label>
        <Input
          name="endAt"
          type="datetime-local"
          defaultValue={initialValues?.endAt?.slice(0, 16) ?? ""}
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">Описание работ</label>
        <Textarea
          name="workDescription"
          defaultValue={initialValues?.workDescription ?? ""}
          className="min-h-24"
          placeholder="Кратко опишите работы, которые выполняются по допуску."
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">Место выполнения работ</label>
        <Input
          name="workplace"
          defaultValue={initialValues?.workplace ?? ""}
          placeholder="Площадка, цех, отметка, помещение или зона."
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подрядчик</label>
        <Select name="contractorId" defaultValue={initialValues?.contractorId ?? ""} disabled={locked}>
          <option value="">Без подрядчика</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Представитель подрядчика</label>
        <Select
          name="contractorRepresentativeId"
          defaultValue={initialValues?.contractorRepresentativeId ?? ""}
          disabled={locked}
        >
          <option value="">Не выбран</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.label}
              {employee.sublabel ? ` (${employee.sublabel})` : ""}
            </option>
          ))}
        </Select>
      </div>

      {[
        ["issuerId", "Выдающий наряд"],
        ["responsibleManagerId", "Ответственный руководитель работ"],
        ["workProducerId", "Производитель работ"],
        ["admitterId", "Допускающий"],
        ["observerId", "Наблюдающий"],
      ].map(([name, label]) => (
        <div key={name} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <Select
            name={name}
            defaultValue={(initialValues?.[name as keyof PermitEntry] as string | null) ?? ""}
            disabled={locked}
          >
            <option value="">Не выбран</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
                {employee.sublabel ? ` (${employee.sublabel})` : ""}
              </option>
            ))}
          </Select>
        </div>
      ))}

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">Исполнители / члены бригады</p>
        <div className="grid gap-2 md:grid-cols-2">
          {employees.map((employee) => (
            <label key={employee.id} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="crewMemberIds"
                value={employee.id}
                defaultChecked={isSelected(initialValues?.crewMemberIds, employee.id)}
                disabled={locked}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {employee.label}
                {employee.sublabel ? (
                  <span className="block text-xs text-slate-500">{employee.sublabel}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Опасные факторы</label>
        <Textarea
          name="hazardFactors"
          defaultValue={initialValues?.hazardFactors?.join("\n") ?? ""}
          className="min-h-28"
          placeholder="Один фактор на строку."
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Меры безопасности</label>
        <Textarea
          name="safetyMeasures"
          defaultValue={initialValues?.safetyMeasures ?? ""}
          className="min-h-28"
          placeholder="Меры безопасности, которые войдут в подписанный payload."
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">Требуемые СИЗ</label>
        <Textarea
          name="ppeRequirements"
          defaultValue={initialValues?.ppeRequirements ?? ""}
          className="min-h-20"
          placeholder="Каска, страховочная система, очки, перчатки..."
          disabled={locked}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ppeIssuedConfirmed"
            defaultChecked={initialValues?.ppeIssuedConfirmed}
            disabled={locked}
            className="h-4 w-4 rounded border-slate-300"
          />
          СИЗ выданы и подтверждены для precheck snapshot
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">Нормативное основание</p>
        <div className="grid gap-2 md:grid-cols-2">
          {legalBasisOptions.map((basis) => (
            <label key={basis.key} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="legalBasis"
                value={basis.key}
                defaultChecked={isSelected(initialValues?.legalBasis, basis.key)}
                disabled={locked}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {basis.label}
                <span className="block text-xs text-slate-500">{basis.marker}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
        {[
          ["trainingEvidenceIds", "Обучение / проверка знаний"],
          ["briefingEvidenceIds", "Инструктаж"],
          ["certificateEvidenceIds", "Удостоверения / квалификация"],
          ["medicalEvidenceIds", "Медосмотр"],
          ["requiredDocumentIds", "Обязательные документы / вложения"],
        ].map(([name, label]) => (
          <div key={name} className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{label}</label>
            <Textarea
              name={`${name}Text`}
              defaultValue={evidenceText(initialValues?.[name as keyof PermitEntry] as string[])}
              className="min-h-20"
              placeholder="ID или номер подтверждающего документа, один на строку."
              disabled={locked}
            />
          </div>
        ))}
      </div>

      {locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:col-span-2">
          Подписанные или согласованные условия допуска заблокированы. Изменения требуют новой
          версии, отмены или отдельного сценария продления.
        </div>
      ) : (
        <div className="lg:col-span-2">
          <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        </div>
      )}
    </form>
  );
}
