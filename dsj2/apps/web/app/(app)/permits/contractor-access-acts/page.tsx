import Link from "next/link";
import type { ReactNode } from "react";
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
import { formatDateTime } from "@dsj/utils";
import {
  activateContractorAccessActAction,
  archiveContractorAccessActAction,
  cancelContractorAccessActAction,
  closeContractorAccessActAction,
  createContractorAccessActAction,
  updateContractorAccessActAction,
} from "@/actions/permits";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";
import { fetchPermitFormOptions } from "@/lib/permit-queries";
import type { PermitOption } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ContractorAccessActRecord = {
  id: string;
  organizationId: string;
  actNumber: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED" | "ARCHIVED";
  branchId: string | null;
  departmentId: string | null;
  workSiteId: string | null;
  contractorOrganizationId: string;
  contractorRepresentativeId: string | null;
  hostRepresentativeEmployeeId: string | null;
  hostUnitChiefEmployeeId: string | null;
  workName: string;
  workDescription: string | null;
  workArea: string;
  workAreaBoundaries: string | null;
  workAreaCoordinates: unknown;
  validFrom: string;
  validTo: string;
  safetyMeasures: string[] | unknown;
  specialConditions: string | null;
  legalBasis: string;
  legalBasisVersion: string;
  legalBasisEffectiveDate: string;
  documentEnvelopeId: string | null;
  currentVersionId: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  contractorOrganization?: { name: string; bin: string | null };
  contractorRepresentative?: { fullName: string; workerNumber: string } | null;
  workSite?: { name: string; location: string | null } | null;
  workPermits?: Array<{
    id: string;
    permitCode: string;
    status: string;
  }>;
};

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function optionList(options: PermitOption[]) {
  return options.map((item) => (
    <option key={item.id} value={item.id}>
      {item.label}
      {item.sublabel ? ` (${item.sublabel})` : ""}
    </option>
  ));
}

function safetyText(value: ContractorAccessActRecord["safetyMeasures"]) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export default async function ContractorAccessActsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess([
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "SAFETY_ENGINEER",
  ]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const successMessage = firstString(params.success);
  const selectedActId = firstString(params.actId);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/permits/contractor-access-acts",
    searchParams: params,
  });
  const companyId = activeCompanyId ?? session.user.companyId ?? null;
  const query = companyId ? `?organizationId=${companyId}&pageSize=100` : "?pageSize=100";
  const [page, options] = await Promise.all([
    apiFetch<{
      items: ContractorAccessActRecord[];
      total: number;
    }>(`core-platform/contractor-access-acts${query}`),
    fetchPermitFormOptions(companyId),
  ]);
  const selectedAct =
    page.items.find((item) => item.id === selectedActId) ?? null;
  const formAction =
    selectedAct && selectedAct.status === "DRAFT"
      ? updateContractorAccessActAction
      : createContractorAccessActAction;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Appendix 3
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Акт-допуск подрядчика
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            MVP entity for transferring a site or work area to a contractor and
            linking it to one or more work permits.
          </p>
        </div>
        <CompanySwitcher
          pathname="/permits/contractor-access-acts"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Реестр актов
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Акт</Th>
                    <Th>Подрядчик</Th>
                    <Th>Зона</Th>
                    <Th>Срок</Th>
                    <Th>Статус</Th>
                    <Th>Наряды</Th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((act) => {
                    const link = companyId
                      ? `/permits/contractor-access-acts?companyId=${companyId}&actId=${act.id}`
                      : `/permits/contractor-access-acts?actId=${act.id}`;
                    return (
                      <tr key={act.id} className="border-t border-slate-100">
                        <Td>
                          <Link href={link} className="font-medium text-slate-900">
                            {act.actNumber}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">
                            {act.workName}
                          </p>
                        </Td>
                        <Td>
                          {act.contractorOrganization?.name ??
                            act.contractorOrganizationId}
                        </Td>
                        <Td>{act.workArea}</Td>
                        <Td>
                          <p>{formatDateTime(act.validFrom)}</p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(act.validTo)}
                          </p>
                        </Td>
                        <Td>
                          <StatusBadge value={act.status.toLowerCase()} />
                        </Td>
                        <Td>{act.workPermits?.length ?? 0}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-950">
                {selectedAct?.status === "DRAFT"
                  ? "Редактировать draft"
                  : "Создать draft"}
              </h2>
              {selectedAct ? (
                <p className="text-sm text-slate-500">
                  Legal basis: {selectedAct.legalBasisVersion}
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="companyId" value={companyId ?? ""} />
              {selectedAct?.status === "DRAFT" ? (
                <input type="hidden" name="actId" value={selectedAct.id} />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Номер акта">
                  <Input
                    name="actNumber"
                    defaultValue={selectedAct?.actNumber ?? ""}
                    required
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  />
                </Field>
                <Field label="Подрядчик">
                  <Select
                    name="contractorOrganizationId"
                    defaultValue={selectedAct?.contractorOrganizationId ?? ""}
                    required
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  >
                    <option value="">Не выбран</option>
                    {optionList(options.contractors)}
                  </Select>
                </Field>
                <Field label="Представитель подрядчика">
                  <Select
                    name="contractorRepresentativeId"
                    defaultValue={selectedAct?.contractorRepresentativeId ?? ""}
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  >
                    <option value="">Не выбран</option>
                    {optionList(options.contractorWorkers)}
                  </Select>
                </Field>
                <Field label="Участок">
                  <Select
                    name="workSiteId"
                    defaultValue={selectedAct?.workSiteId ?? ""}
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  >
                    <option value="">Не выбран</option>
                    {optionList(options.workSites)}
                  </Select>
                </Field>
                <Field label="Принимающая сторона">
                  <Select
                    name="hostRepresentativeEmployeeId"
                    defaultValue={selectedAct?.hostRepresentativeEmployeeId ?? ""}
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  >
                    <option value="">Не выбран</option>
                    {optionList(options.employees)}
                  </Select>
                </Field>
                <Field label="Начальник подразделения">
                  <Select
                    name="hostUnitChiefEmployeeId"
                    defaultValue={selectedAct?.hostUnitChiefEmployeeId ?? ""}
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  >
                    <option value="">Не выбран</option>
                    {optionList(options.employees)}
                  </Select>
                </Field>
                <Field label="Действует с">
                  <Input
                    name="validFrom"
                    type="datetime-local"
                    defaultValue={dateValue(selectedAct?.validFrom)}
                    required
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  />
                </Field>
                <Field label="Действует до">
                  <Input
                    name="validTo"
                    type="datetime-local"
                    defaultValue={dateValue(selectedAct?.validTo)}
                    required
                    disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                  />
                </Field>
              </div>
              <Field label="Наименование работ">
                <Input
                  name="workName"
                  defaultValue={selectedAct?.workName ?? ""}
                  required
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              <Field label="Зона работ">
                <Textarea
                  name="workArea"
                  defaultValue={selectedAct?.workArea ?? ""}
                  required
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              <Field label="Границы зоны">
                <Textarea
                  name="workAreaBoundaries"
                  defaultValue={selectedAct?.workAreaBoundaries ?? ""}
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              <Field label="Описание работ">
                <Textarea
                  name="workDescription"
                  defaultValue={selectedAct?.workDescription ?? ""}
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              <Field label="Мероприятия по безопасности">
                <Textarea
                  name="safetyMeasures"
                  defaultValue={safetyText(selectedAct?.safetyMeasures ?? [])}
                  required
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              <Field label="Особые условия">
                <Textarea
                  name="specialConditions"
                  defaultValue={selectedAct?.specialConditions ?? ""}
                  disabled={Boolean(selectedAct && selectedAct.status !== "DRAFT")}
                />
              </Field>
              {!selectedAct || selectedAct.status === "DRAFT" ? (
                <SubmitButton
                  label={selectedAct ? "Сохранить draft" : "Создать draft"}
                  pendingLabel="Сохранение..."
                />
              ) : null}
            </form>

            {selectedAct ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedAct.status === "DRAFT" ? (
                  <WorkflowButton
                    action={activateContractorAccessActAction}
                    actId={selectedAct.id}
                    companyId={companyId}
                    label="Активировать"
                  />
                ) : null}
                {selectedAct.status === "ACTIVE" ? (
                  <WorkflowButton
                    action={closeContractorAccessActAction}
                    actId={selectedAct.id}
                    companyId={companyId}
                    label="Закрыть"
                  />
                ) : null}
                {["DRAFT", "ACTIVE"].includes(selectedAct.status) ? (
                  <form action={cancelContractorAccessActAction} className="flex gap-2">
                    <input type="hidden" name="actId" value={selectedAct.id} />
                    <input type="hidden" name="companyId" value={companyId ?? ""} />
                    <input
                      type="hidden"
                      name="reason"
                      value="Акт-допуск отменён из карточки."
                    />
                    <SubmitButton label="Отменить" pendingLabel="Отмена..." variant="danger" />
                  </form>
                ) : null}
                {["CLOSED", "CANCELLED"].includes(selectedAct.status) ? (
                  <WorkflowButton
                    action={archiveContractorAccessActAction}
                    actId={selectedAct.id}
                    companyId={companyId}
                    label="Архивировать"
                  />
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function WorkflowButton({
  action,
  actId,
  companyId,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  actId: string;
  companyId: string | null;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="actId" value={actId} />
      <input type="hidden" name="companyId" value={companyId ?? ""} />
      <SubmitButton label={label} pendingLabel="Выполнение..." />
    </form>
  );
}
