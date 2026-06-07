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
  contractorWorkers: PermitOption[];
  departments: PermitOption[];
  workSites: PermitOption[];
  workSitesManageHref?: string;
  contractors: PermitOption[];
  contractorAccessActs: PermitOption[];
  trainingEvidence: PermitOption[];
  briefingEvidence: PermitOption[];
  certificateEvidence: PermitOption[];
  medicalEvidence: PermitOption[];
  requiredDocuments: PermitOption[];
  ppeIssues: PermitOption[];
  initialValues?: PermitEntry | null;
  submitLabel: string;
  pendingLabel: string;
  locked?: boolean;
};

function selected(values: string[] | undefined, value: string) {
  return values?.includes(value) ?? false;
}

function datetimeValue(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function SelectOptions({ options }: { options: PermitOption[] }) {
  return options.map((item) => (
    <option key={item.id} value={item.id}>
      {item.label}
      {item.sublabel ? ` (${item.sublabel})` : ""}
    </option>
  ));
}

function CheckboxOptions({
  name,
  options,
  values,
  locked,
}: {
  name: string;
  options: PermitOption[];
  values?: string[];
  locked: boolean;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {options.map((item) => (
        <label
          key={item.id}
          className="flex items-start gap-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            name={name}
            value={item.id}
            defaultChecked={selected(values, item.id)}
            disabled={locked}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>
            {item.label}
            {item.sublabel ? (
              <span className="block text-xs text-slate-500">
                {item.sublabel}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function PermitEntryForm({
  action,
  hiddenFields,
  employees,
  contractorWorkers,
  departments,
  workSites,
  workSitesManageHref,
  contractors,
  contractorAccessActs,
  trainingEvidence,
  briefingEvidence,
  certificateEvidence,
  medicalEvidence,
  requiredDocuments,
  ppeIssues,
  initialValues,
  submitLabel,
  pendingLabel,
  locked = false,
}: PermitEntryFormProps) {
  const contractorCrewIds =
    initialValues?.crew.flatMap((member) =>
      member.contractorWorkerId ? [member.contractorWorkerId] : [],
    ) ?? [];

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      {hiddenFields.map((field) => (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={field.value ?? ""}
        />
      ))}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          № наряда-допуска
        </label>
        <Input
          name="permitNumber"
          defaultValue={initialValues?.permitNumber ?? ""}
          placeholder="WP-2026-001"
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          № записи в журнале
        </label>
        <Input
          name="journalRegistrationNumber"
          defaultValue={initialValues?.journalRegistrationNumber ?? ""}
          placeholder="PJ-0001"
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Тип допуска
        </label>
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
        <label className="text-sm font-medium text-slate-700">
          Подразделение
        </label>
        <Select
          name="departmentId"
          defaultValue={initialValues?.departmentId ?? ""}
          disabled={locked}
        >
          <option value="">Не выбрано</option>
          <SelectOptions options={departments} />
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Рабочая площадка
        </label>
        <Select
          name="workSiteId"
          defaultValue={initialValues?.workZoneId ?? ""}
          disabled={locked}
        >
          <option value="">Не выбрано</option>
          <SelectOptions options={workSites} />
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
        <label className="text-sm font-medium text-slate-700">
          Начало работ
        </label>
        <Input
          name="startAt"
          type="datetime-local"
          defaultValue={initialValues?.startAt?.slice(0, 16) ?? ""}
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Окончание работ
        </label>
        <Input
          name="endAt"
          type="datetime-local"
          defaultValue={initialValues?.endAt?.slice(0, 16) ?? ""}
          required
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">
          Описание работ
        </label>
        <Textarea
          name="workDescription"
          defaultValue={initialValues?.workDescription ?? ""}
          className="min-h-24"
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">
          Место выполнения работ
        </label>
        <Input
          name="workplace"
          defaultValue={initialValues?.workplace ?? ""}
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">
          Equipment / object of work
        </label>
        <Input
          name="equipmentOrObject"
          defaultValue={initialValues?.equipmentOrObject ?? ""}
          disabled={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Подрядчик</label>
        <Select
          name="contractorId"
          defaultValue={initialValues?.contractorId ?? ""}
          disabled={locked}
        >
          <option value="">Без подрядчика</option>
          <SelectOptions options={contractors} />
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Представитель подрядчика
        </label>
        <Select
          name="contractorRepresentativeId"
          defaultValue={initialValues?.contractorRepresentativeId ?? ""}
          disabled={locked}
        >
          <option value="">Не выбран</option>
          <SelectOptions options={contractorWorkers} />
        </Select>
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">
          РђРєС‚-РґРѕРїСѓСЃРє РїРѕРґСЂСЏРґС‡РёРєР°
        </label>
        <Select
          name="contractorAccessActId"
          defaultValue={initialValues?.contractorAccessActId ?? ""}
          disabled={locked}
        >
          <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
          <SelectOptions options={contractorAccessActs} />
        </Select>
        <p className="text-xs text-slate-500">
          Р”Р»СЏ CONTRACTOR_SITE_ACCESS precheck Р±Р»РѕРєРёСЂСѓРµС‚
          РѕС‚СЃСѓС‚СЃС‚РІРёРµ active Appendix 3 act.
        </p>
      </div>

      {[
        ["issuerId", "Выдающий наряд"],
        ["responsibleManagerId", "Ответственный руководитель"],
        ["workProducerId", "Производитель работ"],
        ["admitterId", "Допускающий"],
        ["observerId", "Наблюдающий"],
      ].map(([name, label]) => (
        <div key={name} className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">{label}</label>
          <Select
            name={name}
            defaultValue={
              (initialValues?.[name as keyof PermitEntry] as string | null) ??
              ""
            }
            disabled={locked}
          >
            <option value="">Не выбран</option>
            <SelectOptions options={employees} />
          </Select>
        </div>
      ))}

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">
          Сотрудники в бригаде
        </p>
        <CheckboxOptions
          name="crewEmployeeIds"
          options={employees}
          values={initialValues?.crewMemberIds}
          locked={locked}
        />
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">
          Работники подрядчика в бригаде
        </p>
        <CheckboxOptions
          name="crewContractorWorkerIds"
          options={contractorWorkers}
          values={contractorCrewIds}
          locked={locked}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Опасные факторы
        </label>
        <Textarea
          name="hazardFactors"
          defaultValue={initialValues?.hazardFactors.join("\n") ?? ""}
          className="min-h-28"
          placeholder="Один фактор на строку"
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Меры безопасности
        </label>
        <Textarea
          name="safetyMeasures"
          defaultValue={initialValues?.safetyMeasures ?? ""}
          className="min-h-28"
          required
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Workplace preparation measures
        </label>
        <Textarea
          name="workplacePreparationMeasures"
          defaultValue={initialValues?.workplacePreparationMeasures ?? ""}
          className="min-h-28"
          disabled={locked}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">
          Safety measure executors
        </label>
        <Textarea
          name="safetyMeasureExecutors"
          defaultValue={initialValues?.safetyMeasureExecutors ?? ""}
          className="min-h-28"
          disabled={locked}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">
          Appendix 1 controls
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="airAnalysisRequired"
              defaultChecked={initialValues?.airAnalysisRequired ?? false}
              disabled={locked}
              className="h-4 w-4 rounded border-slate-300"
            />
            Air analysis required
          </label>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Air analysis date/time
            </label>
            <Input
              name="airAnalysisAt"
              type="datetime-local"
              defaultValue={datetimeValue(initialValues?.airAnalysisAt)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Air analysis result
            </label>
            <Textarea
              name="airAnalysisResult"
              defaultValue={initialValues?.airAnalysisResult ?? ""}
              className="min-h-20"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Air analysis by
            </label>
            <Input
              name="airAnalysisBy"
              defaultValue={initialValues?.airAnalysisBy ?? ""}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Isolation / lockout measures
            </label>
            <Textarea
              name="isolationLockoutMeasures"
              defaultValue={initialValues?.isolationLockoutMeasures ?? ""}
              className="min-h-24"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Fencing and signs
            </label>
            <Textarea
              name="fencingAndSignsMeasures"
              defaultValue={initialValues?.fencingAndSignsMeasures ?? ""}
              className="min-h-24"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Fire safety measures
            </label>
            <Textarea
              name="fireSafetyMeasures"
              defaultValue={initialValues?.fireSafetyMeasures ?? ""}
              className="min-h-24"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Adjacent area approvals / communication
            </label>
            <Textarea
              name="communicationOrAdjacentAreaApprovals"
              defaultValue={
                initialValues?.communicationOrAdjacentAreaApprovals ?? ""
              }
              className="min-h-24"
              disabled={locked}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">
          Target briefing and admission
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Target briefing text
            </label>
            <Textarea
              name="targetBriefingText"
              defaultValue={initialValues?.targetBriefingText ?? ""}
              className="min-h-24"
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Target briefing date/time
            </label>
            <Input
              name="targetBriefingAt"
              type="datetime-local"
              defaultValue={datetimeValue(initialValues?.targetBriefingAt)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Briefing instructor
            </label>
            <Select
              name="targetBriefingInstructorId"
              defaultValue={initialValues?.targetBriefingInstructorId ?? ""}
              disabled={locked}
            >
              <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
              <SelectOptions options={employees} />
            </Select>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm text-slate-700 lg:col-span-2">
            <input
              type="checkbox"
              name="crewAcknowledgementsComplete"
              defaultChecked={
                (initialValues?.crewInstructionAcknowledgements?.length ?? 0) >
                  0 &&
                initialValues?.crewInstructionAcknowledgements?.every(
                  (acknowledgement) =>
                    acknowledgement.status === "acknowledged",
                )
              }
              className="mt-1"
              disabled={locked}
            />
            <span>
              Crew members acknowledged the target briefing. This is an MVP
              payload status, not a legal electronic-signature ceremony.
            </span>
          </label>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Admission date/time
            </label>
            <Input
              name="admissionAt"
              type="datetime-local"
              defaultValue={datetimeValue(initialValues?.admissionAt)}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Admitted by
            </label>
            <Select
              name="admittedById"
              defaultValue={initialValues?.admittedById ?? ""}
              disabled={locked}
            >
              <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
              <SelectOptions options={employees} />
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Work producer accepted at
            </label>
            <Input
              name="acceptedByWorkProducerAt"
              type="datetime-local"
              defaultValue={datetimeValue(
                initialValues?.acceptedByWorkProducerAt,
              )}
              disabled={locked}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <label className="text-sm font-medium text-slate-700">
          Требуемые СИЗ
        </label>
        <Textarea
          name="ppeRequirements"
          defaultValue={initialValues?.ppeRequirements ?? ""}
          className="min-h-20"
          disabled={locked}
        />
        <p className="text-sm font-medium text-slate-900">
          Записи реестра выдачи СИЗ
        </p>
        <CheckboxOptions
          name="ppeIssueRecordIds"
          options={ppeIssues}
          values={initialValues?.ppeIssueRecordIds}
          locked={locked}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <p className="text-sm font-medium text-slate-900">
          Нормативное основание
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {legalBasisOptions.map((basis) => (
            <label
              key={basis.key}
              className="flex items-start gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="legalBasis"
                value={basis.key}
                defaultChecked={selected(initialValues?.legalBasis, basis.key)}
                disabled={locked}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {basis.label}
                <span className="block text-xs text-slate-500">
                  {basis.marker}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {[
        ["trainingEvidenceIds", "Обучение и экзамены", trainingEvidence],
        ["briefingEvidenceIds", "Инструктажи", briefingEvidence],
        [
          "certificateEvidenceIds",
          "Удостоверения и квалификация",
          certificateEvidence,
        ],
        ["medicalEvidenceIds", "Медицинские допуски", medicalEvidence],
        ["requiredDocumentIds", "Обязательные документы", requiredDocuments],
      ].map(([name, label, options]) => (
        <div
          key={name as string}
          className="space-y-2 rounded-lg border border-slate-200 p-4"
        >
          <p className="text-sm font-medium text-slate-900">
            {label as string}
          </p>
          <CheckboxOptions
            name={name as string}
            options={options as PermitOption[]}
            values={
              initialValues?.[name as keyof PermitEntry] as string[] | undefined
            }
            locked={locked}
          />
        </div>
      ))}

      {locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:col-span-2">
          После отправки на согласование условия допуска блокируются.
        </div>
      ) : (
        <div className="lg:col-span-2">
          <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        </div>
      )}
    </form>
  );
}
