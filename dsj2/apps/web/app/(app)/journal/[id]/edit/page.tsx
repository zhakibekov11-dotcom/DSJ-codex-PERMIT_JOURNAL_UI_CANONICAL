import Link from "next/link";
import type { BriefingJournalEntry, BriefingType } from "@dsj/types";
import { Card, CardContent, CardHeader, Input, PageHeader, Select, Textarea } from "@dsj/ui";
import { updateBriefingAction } from "@/actions/briefing";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";
import {
  briefingJournalKindLabels,
  briefingTypeLabels,
  roleLabels,
} from "@/lib/labels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const safetyEngineerBriefingTypes: BriefingType[] = [
  "INTRODUCTORY",
  "REPEATED",
  "UNSCHEDULED",
  "TARGETED",
];

function allowedBriefingTypesForPersona(personaKey: string | undefined): BriefingType[] {
  if (personaKey === "shop-chief") {
    return ["PRIMARY"];
  }

  if (personaKey === "safety-engineer") {
    return safetyEngineerBriefingTypes;
  }

  return ["INTRODUCTORY", "PRIMARY", "REPEATED", "UNSCHEDULED", "TARGETED"];
}

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

function timeInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toTimeString().slice(0, 5);
}

export default async function EditBriefingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = typeof rawSearchParams.error === "string" ? rawSearchParams.error : null;
  const record = await apiFetch<BriefingJournalEntry>(`briefing-records/${id}`);
  const scopedQuery = record.organizationId ? `?companyId=${record.organizationId}` : "";
  const [employees, departments, users] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        accountEmail?: string | null;
        accountRole?: string | null;
        hasEmployeeSignerAccount?: boolean;
        department?: { id: string; name: string } | null;
        site?: { id: string; name: string } | null;
      }>
    >(`employees${scopedQuery}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${scopedQuery}`),
    apiFetch<Array<{ id: string; fullName: string; email: string; role: string }>>(`users${scopedQuery}`),
  ]);
  const isShopChiefPersona = currentDemoPersona?.key === "shop-chief";
  const isSafetyEngineerPersona = currentDemoPersona?.key === "safety-engineer";
  const scopedEmployees = isShopChiefPersona
    ? employees.filter(
        (employee) =>
          employee.department?.name === currentDemoPersona.scopeDepartmentName &&
          employee.site?.name === currentDemoPersona.scopeSiteName,
      )
    : employees;
  const participantCandidates = scopedEmployees.filter(
    (employee) =>
      employee.id === record.employeeId ||
      employee.hasEmployeeSignerAccount === true,
  );
  const scopedDepartments = isShopChiefPersona
    ? departments.filter((department) => department.name === currentDemoPersona.scopeDepartmentName)
    : departments;
  const instructors =
    isShopChiefPersona || isSafetyEngineerPersona
      ? users.filter((user) => user.email === session.user.email)
      : users;
  const allowedBriefingTypes = allowedBriefingTypesForPersona(currentDemoPersona?.key);
  const detailHref = `/journal/${record.id}${scopedQuery}`;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Draft edit
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {record.registrationNo ?? `Draft #${record.id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Редактирование доступно только до prepare-sign.
          </p>
        </div>
        <StatusBadge value={record.status} />
      </PageHeader>

      {!record.allowedActions.canEditDraft ? (
        <Card className="rounded-[24px]">
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Запись вышла из DRAFT. Backend запрещает content mutation после
              подготовки к подписи или финального подписания.
            </div>
            <Link
              href={detailHref}
              className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Вернуться к записи
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Canonical draft fields
            </h2>
          </CardHeader>
          <CardContent>
            <form action={updateBriefingAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="briefingId" value={record.id} />
              <input type="hidden" name="companyId" value={record.organizationId} />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Сотрудник</label>
                <Select name="employeeId" defaultValue={record.employeeId}>
                  {participantCandidates.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.employeeNumber})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Инструктор</label>
                <Select name="instructorUserId" defaultValue={record.instructorUserId}>
                  {instructors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({roleLabels[user.role] ?? user.role})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Журнал</label>
                <Select name="journalKind" defaultValue={record.journalKind}>
                  {Object.entries(briefingJournalKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Тип инструктажа</label>
                <Select name="briefingType" defaultValue={record.briefingType}>
                  {allowedBriefingTypes.map((value) => (
                    <option key={value} value={value}>
                      {briefingTypeLabels[value] ?? value}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Подразделение</label>
                <Select name="departmentId" defaultValue={record.departmentId ?? ""}>
                  <option value="">Не назначено</option>
                  {scopedDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Дата</label>
                  <Input
                    name="briefingDate"
                    type="date"
                    defaultValue={dateInputValue(record.briefingDate)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Время</label>
                  <Input
                    name="briefingTime"
                    type="time"
                    defaultValue={timeInputValue(record.briefingTime)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Тема</label>
                <Input name="topic" defaultValue={record.topic} minLength={3} required />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Программа</label>
                <Textarea name="program" defaultValue={record.program ?? ""} rows={6} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Основание</label>
                <Textarea name="basis" defaultValue={record.basis ?? ""} rows={3} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Причина внепланового / целевого
                </label>
                <Textarea
                  name="unscheduledReason"
                  defaultValue={record.unscheduledReason ?? ""}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Примечания</label>
                <Textarea name="notes" defaultValue={record.notes ?? ""} rows={4} />
              </div>

              <div className="flex items-end gap-3 md:col-span-2">
                <SubmitButton
                  label="Сохранить draft"
                  pendingLabel="Сохранение..."
                />
                <Link
                  href={detailHref}
                  className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Отмена
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
