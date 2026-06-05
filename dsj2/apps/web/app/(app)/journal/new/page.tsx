import { Card, CardContent, CardHeader, PageHeader, Select } from "@dsj/ui";
import type { BriefingType } from "@dsj/types";
import { redirect } from "next/navigation";
import { createBriefingAction } from "../../../../actions/briefing";
import { BriefingParticipantPicker } from "../../../../components/briefing-participant-picker";
import { BriefingRegulationFields } from "../../../../components/briefing-regulation-fields";
import { CompanySwitcher } from "../../../../components/company-switcher";
import { SubmitButton } from "../../../../components/submit-button";
import { apiFetch } from "../../../../lib/api";
import { requireRoleAccess } from "../../../../lib/auth";
import { resolveCompanyContext } from "../../../../lib/company-context";
import { getDemoPersonaForEmail } from "../../../../lib/demo-personas";
import { roleLabels } from "../../../../lib/labels";

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

export default async function NewBriefingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const currentDemoPersona = getDemoPersonaForEmail(session.user.email);

  if (currentDemoPersona?.readOnly) {
    redirect("/journal");
  }

  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/journal/new",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const [employees, departments, users] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        hasAccount?: boolean;
        accountEmail?: string | null;
        accountRole?: string | null;
        hasEmployeeSignerAccount?: boolean;
        department?: { id: string; name: string } | null;
        site?: { id: string; name: string } | null;
        contractorCompany?: { name: string } | null;
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
  const participantCandidates = scopedEmployees;
  const scopedDepartments = isShopChiefPersona
    ? departments.filter((department) => department.name === currentDemoPersona.scopeDepartmentName)
    : departments;
  const instructors =
    isShopChiefPersona || isSafetyEngineerPersona
      ? users.filter((user) => user.email === session.user.email)
      : users;
  const scopedSiteId = scopedEmployees.find((employee) => employee.site?.id)?.site?.id ?? "";
  const allowedBriefingTypes = allowedBriefingTypesForPersona(currentDemoPersona?.key);
  const participantSearchQuery = new URLSearchParams();

  if (activeCompanyId) {
    participantSearchQuery.set("companyId", activeCompanyId);
  }

  const participantSearchEndpoint = `/api/journal/participant-candidates${
    participantSearchQuery.toString() ? `?${participantSearchQuery.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Новая запись</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Создать запись инструктажа</h1>
        </div>
        <CompanySwitcher
          pathname="/journal/new"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Детали записи</h2>
        </CardHeader>
        <CardContent>
          <form action={createBriefingAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700">Участники инструктажа</label>
                <p className="text-xs text-slate-400">
                  Можно добавлять и исключать сотрудников из списка. Для каждого будет создана отдельная запись с подписью инструктора и сотрудника.
                </p>
              </div>
              <BriefingParticipantPicker
                employees={participantCandidates}
                searchEndpoint={participantSearchEndpoint}
                availableDescription="Ищи по ФИО, табельному номеру, типу сотрудника или подрядной компании. Черновик можно создать без личного кабинета."
                availableEmptyState="Активные сотрудники не найдены."
                showSigningReadiness
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Инструктирующий</label>
              <Select name="instructorUserId" required defaultValue={instructors[0]?.id ?? ""}>
                <option value="" disabled>
                  Выберите инструктора
                </option>
                {instructors.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({roleLabels[user.role] ?? user.role})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Подразделение</label>
              <Select name="departmentId" defaultValue="">
                <option value="">Не назначено</option>
                {scopedDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
              {isShopChiefPersona ? <input type="hidden" name="workSiteId" value={scopedSiteId} /> : null}
            </div>
            <BriefingRegulationFields allowedBriefingTypes={allowedBriefingTypes} />
            <div className="flex items-end md:col-span-2">
              <SubmitButton label="Создать инструктаж" pendingLabel="Создание..." />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
