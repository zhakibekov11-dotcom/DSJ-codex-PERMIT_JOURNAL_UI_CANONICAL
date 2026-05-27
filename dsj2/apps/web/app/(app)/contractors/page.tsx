import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Table,
  TableWrapper,
  Td,
  Textarea,
  Th,
} from "@dsj/ui";
import {
  createContractorCompanyAction,
  deleteContractorCompanyAction,
  updateContractorCompanyAction,
} from "../../../actions/contractor";
import { CompanySwitcher } from "../../../components/company-switcher";
import { DeleteContractorCompanyButton } from "../../../components/delete-contractor-company-button";
import { StatusBadge } from "../../../components/status-badge";
import { SubmitButton } from "../../../components/submit-button";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function buildContractorsUrl(
  companyId: string | null,
  editId?: string | null,
) {
  const params = new URLSearchParams();

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (editId) {
    params.set("edit", editId);
  }

  const query = params.toString();
  return query ? `/contractors?${query}` : "/contractors";
}

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/contractors",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const contractorCompanies = await apiFetch<
    Array<{
      id: string;
      name: string;
      bin: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      notes: string | null;
      isActive: boolean;
      _count: {
        employees: number;
      };
    }>
  >(`contractor-companies${scopedQuery}`);

  const editingContractor =
    contractorCompanies.find((company) => company.id === editId) ?? null;
  const formAction = editingContractor
    ? updateContractorCompanyAction
    : createContractorCompanyAction;
  const formTitle = editingContractor
    ? "Редактировать подрядчика"
    : "Добавить подрядчика";
  const formDescription = editingContractor
    ? "Обновите карточку организации и её рабочий статус."
    : "Новая подрядная организация сразу появится в выборе сотрудников и журналов.";

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-950">
            Подрядные организации
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Реестр подрядчиков для сотрудников, инструктажей и удостоверений.
          </p>
        </div>
        <CompanySwitcher
          pathname="/contractors"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Список подрядчиков
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Компания</Th>
                    <Th>БИН</Th>
                    <Th>Контакт</Th>
                    <Th>Сотрудники</Th>
                    <Th>Статус</Th>
                    <Th>Действия</Th>
                  </tr>
                </thead>
                <tbody>
                  {contractorCompanies.map((company) => (
                    <tr key={company.id} className="border-t border-slate-100">
                      <Td>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">
                            {company.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {company.contactEmail ?? "Без email"}
                          </p>
                          {company.notes ? (
                            <p className="line-clamp-2 text-xs text-slate-500">
                              {company.notes}
                            </p>
                          ) : null}
                        </div>
                      </Td>
                      <Td>{company.bin ?? "—"}</Td>
                      <Td>{company.contactPhone ?? "—"}</Td>
                      <Td>{company._count.employees}</Td>
                      <Td>
                        <StatusBadge
                          value={company.isActive ? "active" : "inactive"}
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Link
                            href={buildContractorsUrl(
                              activeCompanyId,
                              company.id,
                            )}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                          >
                            Редактировать
                          </Link>
                          <form action={deleteContractorCompanyAction}>
                            <input
                              type="hidden"
                              name="companyId"
                              value={activeCompanyId ?? ""}
                            />
                            <input
                              type="hidden"
                              name="contractorCompanyId"
                              value={company.id}
                            />
                            <DeleteContractorCompanyButton
                              companyName={company.name}
                            />
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">
                {formTitle}
              </h2>
              <p className="text-sm text-slate-500">{formDescription}</p>
            </div>
          </CardHeader>
          <CardContent>
            {activeCompanyId ? (
              <form action={formAction} className="space-y-4">
                <input
                  type="hidden"
                  name="companyId"
                  value={activeCompanyId}
                />
                {editingContractor ? (
                  <input
                    type="hidden"
                    name="contractorCompanyId"
                    value={editingContractor.id}
                  />
                ) : null}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Название компании
                  </label>
                  <Input
                    name="name"
                    defaultValue={editingContractor?.name ?? ""}
                    placeholder="West Caspian Service LLP"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    БИН
                  </label>
                  <Input
                    name="bin"
                    defaultValue={editingContractor?.bin ?? ""}
                    placeholder="220340018877"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <Input
                      name="contactEmail"
                      type="email"
                      defaultValue={editingContractor?.contactEmail ?? ""}
                      placeholder="hse@contractor.kz"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Телефон
                    </label>
                    <Input
                      name="contactPhone"
                      defaultValue={editingContractor?.contactPhone ?? ""}
                      placeholder="+77015550111"
                    />
                  </div>
                </div>
                {editingContractor ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      Статус
                    </label>
                    <Select
                      name="isActive"
                      defaultValue={editingContractor.isActive ? "true" : "false"}
                    >
                      <option value="true">Активен</option>
                      <option value="false">Неактивен</option>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Примечания
                  </label>
                  <Textarea
                    name="notes"
                    defaultValue={editingContractor?.notes ?? ""}
                    placeholder="Контактное лицо, проект, требования по допуску или условия взаимодействия."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <SubmitButton
                    label={
                      editingContractor
                        ? "Сохранить изменения"
                        : "Добавить подрядчика"
                    }
                    pendingLabel={
                      editingContractor ? "Сохранение..." : "Создание..."
                    }
                  />
                  {editingContractor ? (
                    <Link
                      href={buildContractorsUrl(activeCompanyId)}
                      className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50"
                    >
                      Отменить
                    </Link>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Сначала выберите компанию, чтобы управлять её подрядными
                организациями.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
