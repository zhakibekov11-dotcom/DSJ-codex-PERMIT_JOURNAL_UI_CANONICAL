import { Card, CardContent, CardHeader, Input, PageHeader } from "@dsj/ui";
import { Building2, ShieldCheck, UsersRound } from "lucide-react";
import {
  createCompanyAction,
  deleteCompanyAction,
} from "../../../actions/company";
import { DeleteCompanyButton } from "../../../components/delete-company-button";
import { SubmitButton } from "../../../components/submit-button";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";

function formatLastLogin(value: string | null) {
  if (!value) {
    return "Ещё не входил";
  }

  return new Intl.DateTimeFormat("ru-KZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CompaniesPage() {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const companies = await apiFetch<
    Array<{
      id: string;
      name: string;
      bin: string | null;
      industry: string | null;
      timezone: string;
      _count: {
        employees: number;
        briefingRecords: number;
        users: number;
      };
      responsibleAdmin: {
        id: string;
        fullName: string;
        email: string;
        lastLoginAt: string | null;
      } | null;
    }>
  >("companies");

  const canManageCompanies = session.user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-950">Компании</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Реестр компаний, их ответственных администраторов и рабочего контура.
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {company.industry ?? "Без отрасли"}
                    </p>
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-slate-950">
                        {company.name}
                      </h2>
                      <p className="text-sm text-slate-500">
                        БИН: {company.bin ?? "Не указан"} • {company.timezone}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border border-slate-200 bg-slate-50 p-3 text-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      Пользователи
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {company._count.users}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      Сотрудники
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {company._count.employees}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      Журналы
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {company._count.briefingRecords}
                    </p>
                  </div>
                </div>

                <div className="border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-slate-900">
                        Ответственный администратор
                      </p>
                      {company.responsibleAdmin ? (
                        <>
                          <p className="text-sm text-slate-900">
                            {company.responsibleAdmin.fullName}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {company.responsibleAdmin.email}
                          </p>
                          <p className="text-xs text-slate-400">
                            Последний вход:{" "}
                            {formatLastLogin(company.responsibleAdmin.lastLoginAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Не назначен.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {canManageCompanies ? (
                  <form action={deleteCompanyAction} className="flex justify-end">
                    <input type="hidden" name="companyId" value={company.id} />
                    <DeleteCompanyButton companyName={company.name} />
                  </form>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Новая компания
            </h2>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManageCompanies ? (
              <form action={createCompanyAction} className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">
                    Параметры компании
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Название компании
                    </label>
                    <Input
                      name="name"
                      placeholder="Степная промышленная служба"
                      required
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        БИН
                      </label>
                      <Input name="bin" placeholder="190140028341" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">
                        Отрасль
                      </label>
                      <Input name="industry" placeholder="Промышленность" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Ответственный администратор
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      ФИО
                    </label>
                    <Input
                      name="responsibleFullName"
                      placeholder="Айдос Ермеков"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <Input
                      name="responsibleEmail"
                      type="email"
                      placeholder="admin@company.kz"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Временный пароль
                    </label>
                    <Input
                      name="responsiblePassword"
                      type="password"
                      placeholder="Минимум 8 символов"
                      required
                    />
                  </div>
                </div>

                <input type="hidden" name="timezone" value="Asia/Almaty" />
                <SubmitButton
                  label="Создать компанию"
                  pendingLabel="Создание..."
                />
              </form>
            ) : (
              <div className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Создание и удаление компаний доступно только суперадминистратору
                платформы.
              </div>
            )}

            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-slate-200 bg-white p-2 text-slate-700">
                  <UsersRound className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Что создаётся автоматически
                  </p>
                  <p className="text-sm text-slate-500">
                    Вместе с компанией сразу создаётся ответственный
                    администратор с доступом в её контур.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
