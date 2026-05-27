import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import {
  createComplianceDocumentTypeAction,
  createComplianceMatrixAction,
  createPositionAction,
  createRetentionPolicyAction,
} from "../../../actions/compliance";
import { CompanySwitcher } from "../../../components/company-switcher";
import { StatusBadge } from "../../../components/status-badge";
import { apiFetch } from "../../../lib/api";
import { requireRoleAccess } from "../../../lib/auth";
import { resolveCompanyContext } from "../../../lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

const documentTypeCategoryLabels: Record<string, string> = {
  DOCUMENT: "Документ",
  TRAINING: "Обучение",
  INSTRUCTION: "Инструктаж",
};

const documentKindLabels: Record<string, string> = {
  EMPLOYEE_DOCUMENT: "Документ сотрудника",
  BRIEFING_JOURNAL: "Журнал инструктажей",
  BRIEFING_JOURNAL_ENTRY: "Запись журнала инструктажа",
  ORDER: "Приказ",
  WORK_PERMIT: "Наряд-допуск",
  TRAINING_PLAN: "План обучения",
  QUALIFICATION_DOCUMENT: "Документ о квалификации",
};

const retentionScopeLabels: Record<string, string> = {
  ORGANIZATION: "Организация",
  BRANCH: "Филиал",
  DEPARTMENT: "Подразделение",
  WORK_SITE: "Объект",
};

const retentionUnitDisplayLabels: Record<string, string> = {
  DAYS: "Дни",
  MONTHS: "Месяцы",
  YEARS: "Годы",
  INDEFINITE: "Бессрочно",
};

const archiveFormatLabels: Record<string, string> = {
  PDF_A_1: "PDF/A-1",
  PDF: "PDF",
  JSON: "JSON",
  ZIP: "ZIP",
};

function getLabel(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (start && end) {
    return `с ${formatDate(start)} по ${formatDate(end)}`;
  }

  if (start) {
    return `с ${formatDate(start)}`;
  }

  if (end) {
    return `до ${formatDate(end)}`;
  }

  return "без срока";
}

function formatRetentionDuration(value: number, unit: string) {
  if (unit === "INDEFINITE") {
    return "Бессрочно";
  }

  return `${value} ${getLabel(retentionUnitDisplayLabels, unit)}`;
}

function formatArchiveFormat(value: string) {
  return getLabel(archiveFormatLabels, value);
}

function getRetentionSourceLabel(legalBasis: string) {
  return legalBasis.startsWith("P0 baseline:")
    ? "Источник: базовое правило"
    : "Источник: настроено вручную";
}

function summarizeMatrix(payload?: {
  requiredDocuments?: unknown[];
  requiredTrainings?: unknown[];
  requiredInstructions?: unknown[];
  notes?: string | null;
} | null) {
  const documents = payload?.requiredDocuments?.length ?? 0;
  const trainings = payload?.requiredTrainings?.length ?? 0;
  const instructions = payload?.requiredInstructions?.length ?? 0;

  return {
    documents,
    trainings,
    instructions,
    total: documents + trainings + instructions,
  };
}

export default async function CompliancePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = firstString(params.error);
  const successMessage = firstString(params.success);
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/compliance",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const [positions, documentTypes, matrices, retentionPolicies] = activeCompanyId
    ? await Promise.all([
        apiFetch<
          Array<{
            id: string;
            code: string;
            name: string;
            grade: string | null;
            isActive: boolean;
            createdAt: string;
          }>
        >(`core-platform/positions${scopedQuery}`),
        apiFetch<
          Array<{
            id: string;
            code: string;
            name: string;
            category: "DOCUMENT" | "TRAINING" | "INSTRUCTION";
            defaultValidityDays: number | null;
            requiresExpiry: boolean;
            requiresVerification: boolean;
            isActive: boolean;
          }>
        >(`core-platform/document-types${scopedQuery}`),
        apiFetch<
          Array<{
            id: string;
            matrixCode: string;
            status: string;
            position?: { name: string; code: string } | null;
            effectiveFrom: string | null;
            effectiveTo: string | null;
            currentVersion?:
              | {
                  id: string;
                  versionNo: number;
                  status: string;
                  effectiveFrom: string | null;
                  effectiveTo: string | null;
                  payloadJson?: {
                    requiredDocuments?: unknown[];
                    requiredTrainings?: unknown[];
                    requiredInstructions?: unknown[];
                    notes?: string | null;
                  } | null;
                }
              | null;
            versions: Array<{ id: string; versionNo: number; status: string }>;
          }>
        >(`core-platform/job-requirement-matrices${scopedQuery}`),
        apiFetch<
          Array<{
            id: string;
            retentionCode: string;
            documentKind: string;
            scopeType: string;
            retentionValue: number;
            retentionUnit: string;
            archiveFormat: string;
            legalBasis: string;
            holdAllowed: boolean;
            destructionApprovalRequired: boolean;
            effectiveFrom: string;
            effectiveTo: string | null;
            description: string | null;
          }>
        >(`core-platform/retention-policies${scopedQuery}`),
      ])
    : [[], [], [], []];

  const documents = documentTypes.filter((item) => item.category === "DOCUMENT" && item.isActive);
  const trainings = documentTypes.filter((item) => item.category === "TRAINING" && item.isActive);
  const instructions = documentTypes.filter((item) => item.category === "INSTRUCTION" && item.isActive);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <div className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Конфигурация допуска
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Правила допуска</h1>
          <p className="mt-2 text-sm text-slate-500">
            Это конфигурационный экран, а не операционный реестр. Здесь настраиваются
            должности, типы документов, правила хранения и матрицы, по которым система
            потом считает допуск сотрудника.
          </p>
        </div>
        <CompanySwitcher pathname="/compliance" companies={companies} activeCompanyId={activeCompanyId} searchParams={params} />
      </PageHeader>

      <Card className="rounded-[24px] border-slate-200 bg-slate-50/80">
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_minmax(0,1fr)]">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                Как это используется
              </p>
              <h2 className="text-lg font-semibold text-slate-950">
                Настройки здесь определяют, что система считает обязательным для допуска.
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Карточка сотрудника, документы, журналы инструктажей, протоколы, приказы и
                архивные записи читают именно эти правила. Если меняется должность, тип
                документа или правило хранения, меняется и расчёт допуска.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-900">Карточка сотрудника</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Позиция и документы отсюда напрямую влияют на статус допуска в карточке
                  сотрудника.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-900">Расчёт допуска</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Матрица требований решает, будет ли сотрудник допущен, ограничен или
                  заблокирован.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-900">Журналы и протоколы</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Инструктажи, протоколы и приказы используются как основания для проверки
                  допуска.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-900">Архив</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Правила хранения задают срок, формат архива и условия уничтожения
                  архивного пакета.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!activeCompanyId ? (
        <Card className="rounded-[24px]">
          <CardContent className="p-6">
            <EmptyState className="min-h-24 justify-center text-left">
              Сначала выберите компанию. После этого здесь появятся должности, справочник
              типов документов, правила хранения и матрицы для выбранного контура.
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                label: "Должности",
                value: positions.length,
                hint: "Для них строятся матрицы допуска и считается статус сотрудника.",
              },
              {
                label: "Типы документов",
                value: documentTypes.length,
                hint: "Используются в карточке сотрудника, журналах, протоколах и приказах.",
              },
              {
                label: "Правила хранения",
                value: retentionPolicies.length,
                hint: "Определяют срок хранения, формат архива и условия уничтожения.",
              },
              {
                label: "Матрицы",
                value: matrices.length,
                hint: "По ним система решает, хватает ли сотруднику обязательных оснований.",
              },
            ].map((item) => (
              <Card key={item.label} className="rounded-[24px]">
                <CardContent className="space-y-2 p-6">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="text-3xl font-semibold text-slate-950">{item.value}</p>
                  <p className="text-sm leading-5 text-slate-600">{item.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_24rem]">
            <div className="space-y-6">
              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Должности</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Базовый справочник, на который опираются карточка сотрудника и матрица
                    допуска.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {positions.length ? (
                    positions.map((position) => (
                      <div key={position.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-950">{position.name}</p>
                            <p className="text-sm text-slate-500">{position.code}</p>
                          </div>
                          <StatusBadge value={position.isActive ? "active" : "inactive"} />
                        </div>
                        <p className="mt-3 text-sm text-slate-700">Разряд: {position.grade ?? "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">Создано {formatDate(position.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState className="min-h-24 justify-center text-left">
                      Должности пока не добавлены.
                    </EmptyState>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Типы документов</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Справочник типов для документов, обучений и инструктажей. Эти записи
                    используются в карточке сотрудника, журналах, протоколах и приказах.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {documentTypes.length ? (
                    documentTypes.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-950">{item.name}</p>
                            <p className="text-sm text-slate-500">
                              {item.code} • {documentTypeCategoryLabels[item.category] ?? item.category}
                            </p>
                          </div>
                          <StatusBadge value={item.isActive ? "active" : "inactive"} />
                        </div>
                        <p className="mt-3 text-sm text-slate-700">
                          Срок действия: {item.defaultValidityDays ? `${item.defaultValidityDays} дней` : "Без срока по умолчанию"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Истечение: {item.requiresExpiry ? "обязательно" : "необязательно"} • Проверка:{" "}
                          {item.requiresVerification ? "обязательно" : "необязательно"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyState className="min-h-24 justify-center text-left">
                      Типы документов пока не добавлены.
                    </EmptyState>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Правила хранения</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Определяют срок хранения, формат архива и условия для архивного пакета с
                    подписями и доказательствами. Формат архива сейчас фиксируется как PDF/A-1.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {retentionPolicies.length ? (
                    retentionPolicies.map((policy) => (
                      <div
                        key={policy.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-950">{policy.retentionCode}</p>
                            <p className="text-sm text-slate-500">
                              {getLabel(documentKindLabels, policy.documentKind)} •{" "}
                              {getLabel(retentionScopeLabels, policy.scopeType)}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-slate-900">
                            {formatRetentionDuration(policy.retentionValue, policy.retentionUnit)}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Формат: {formatArchiveFormat(policy.archiveFormat)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Холд: {policy.holdAllowed ? "разрешён" : "запрещён"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Уничтожение:{" "}
                            {policy.destructionApprovalRequired
                              ? "по согласованию"
                              : "без согласования"}
                          </span>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Действует {formatDateRange(policy.effectiveFrom, policy.effectiveTo)} •{" "}
                          {getRetentionSourceLabel(policy.legalBasis)}
                        </p>

                        {policy.description ? (
                          <p className="mt-2 text-sm text-slate-600">{policy.description}</p>
                        ) : null}

                        <p className="mt-2 text-sm text-slate-700">{policy.legalBasis}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState className="min-h-24 justify-center text-left">
                      Правила хранения пока не добавлены.
                    </EmptyState>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Матрицы</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Связывают должность с обязательными документами, обучениями и
                    инструктажами. Именно по ним система считает, хватает ли сотруднику
                    оснований для допуска.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {matrices.length ? (
                    matrices.map((matrix) => {
                      const payload = matrix.currentVersion?.payloadJson ?? {};
                      const summary = summarizeMatrix(payload);

                      return (
                        <div
                          key={matrix.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-950">{matrix.matrixCode}</p>
                              <p className="text-sm text-slate-500">
                                {matrix.position?.name ?? "Без должности"} •{" "}
                                {matrix.position?.code ?? "—"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {matrix.status ? <StatusBadge value={matrix.status} /> : null}
                              {matrix.currentVersion?.status ? (
                                <StatusBadge value={matrix.currentVersion.status} />
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p>Требований: {summary.total}</p>
                            <p>
                              Документы: {summary.documents} • Обучения: {summary.trainings} • Инструктажи:{" "}
                              {summary.instructions}
                            </p>
                            <p>Матрица: {formatDateRange(matrix.effectiveFrom, matrix.effectiveTo)}</p>
                            <p>
                              Версия:{" "}
                              {matrix.currentVersion ? `v${matrix.currentVersion.versionNo}` : "не создана"} •{" "}
                              {formatDateRange(
                                matrix.currentVersion?.effectiveFrom,
                                matrix.currentVersion?.effectiveTo,
                              )}
                            </p>
                          </div>

                          {payload.notes ? (
                            <p className="mt-3 text-sm text-slate-600">{payload.notes}</p>
                          ) : null}

                          <p className="mt-2 text-xs text-slate-500">
                            Версий в истории: {matrix.versions.length}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState className="min-h-24 justify-center text-left">
                      Матрицы пока не добавлены.
                    </EmptyState>
                  )}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Новая должность</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Создаёт должность, которую потом можно связать с матрицей допуска и
                    карточкой сотрудника.
                  </p>
                </CardHeader>
                <CardContent>
                  <form action={createPositionAction} className="space-y-4">
                    <input type="hidden" name="companyId" value={activeCompanyId} />
                    <Input name="code" placeholder="ELEC-01" required />
                    <Input name="name" placeholder="Электрик" required />
                    <Input name="grade" placeholder="5" />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Активна
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-700"
                    >
                      Создать должность
                    </button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Новый тип документа</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Создаёт тип, который система будет использовать для документов,
                    обучений и инструктажей в допуске сотрудника.
                  </p>
                </CardHeader>
                <CardContent>
                  <form action={createComplianceDocumentTypeAction} className="space-y-4">
                    <input type="hidden" name="companyId" value={activeCompanyId} />
                    <Input name="code" placeholder="MED-CHECK" required />
                    <Input name="name" placeholder="Медицинский осмотр" required />
                    <Select name="category" defaultValue="DOCUMENT">
                      <option value="DOCUMENT">Документ</option>
                      <option value="TRAINING">Обучение</option>
                      <option value="INSTRUCTION">Инструктаж</option>
                    </Select>
                    <Input name="defaultValidityDays" type="number" min="1" placeholder="365" />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="requiresExpiry" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Требуется срок действия
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="requiresVerification" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Требуется проверка
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Активно
                    </label>
                    <Textarea
                      name="description"
                      className="min-h-24"
                      placeholder="Базовый тип документа или основания для расчета допуска."
                    />
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-700"
                    >
                      Создать тип документа
                    </button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Новое правило хранения</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Определяет срок хранения, формат архива и условия уничтожения для
                    архивного пакета.
                  </p>
                </CardHeader>
                <CardContent>
                  <form action={createRetentionPolicyAction} className="space-y-4">
                    <input type="hidden" name="companyId" value={activeCompanyId} />
                    <input type="hidden" name="archiveFormat" value="PDF_A_1" />
                    <Input name="retentionCode" placeholder="EMP_DOC_5Y" required />
                    <Select name="documentKind" defaultValue="EMPLOYEE_DOCUMENT">
                      <option value="EMPLOYEE_DOCUMENT">Документ сотрудника</option>
                      <option value="BRIEFING_JOURNAL">Журнал инструктажей</option>
                      <option value="BRIEFING_JOURNAL_ENTRY">Запись журнала инструктажа</option>
                      <option value="ORDER">Приказ</option>
                      <option value="WORK_PERMIT">Наряд-допуск</option>
                      <option value="TRAINING_PLAN">План обучения</option>
                      <option value="QUALIFICATION_DOCUMENT">Документ о квалификации</option>
                    </Select>
                    <Select name="scopeType" defaultValue="ORGANIZATION">
                      <option value="ORGANIZATION">Организация</option>
                      <option value="BRANCH">Филиал</option>
                      <option value="DEPARTMENT">Подразделение</option>
                      <option value="WORK_SITE">Объект</option>
                    </Select>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input name="retentionValue" type="number" min="0" defaultValue="5" required />
                      <Select name="retentionUnit" defaultValue="YEARS">
                        <option value="DAYS">Дни</option>
                        <option value="MONTHS">Месяцы</option>
                        <option value="YEARS">Годы</option>
                        <option value="INDEFINITE">Бессрочно</option>
                      </Select>
                    </div>
                    <Input name="effectiveFrom" type="date" defaultValue={todayIso} required />
                    <Textarea
                      name="legalBasis"
                      className="min-h-24"
                      defaultValue="Системное правило хранения для контуров допуска."
                      required
                    />
                    <Input name="description" placeholder="Базовый срок хранения для документов сотрудников" />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="holdAllowed" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                      Приостановка разрешена
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="destructionApprovalRequired" className="h-4 w-4 rounded border-slate-300" />
                      Требуется согласование уничтожения
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-700"
                    >
                      Создать правило хранения
                    </button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-slate-950">Новая матрица</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Связывает должность с обязательными документами, обучениями и
                    инструктажами.
                  </p>
                </CardHeader>
                <CardContent>
                  {positions.length && documentTypes.length ? (
                    <form action={createComplianceMatrixAction} className="space-y-4">
                      <input type="hidden" name="companyId" value={activeCompanyId} />
                      <Input name="matrixCode" placeholder="ELEC-ADM-2026" required />
                      <Select name="positionId" defaultValue={positions[0]?.id}>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.name} ({position.code})
                          </option>
                        ))}
                      </Select>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input name="effectiveFrom" type="date" defaultValue={todayIso} required />
                        <Input name="effectiveTo" type="date" />
                      </div>
                      <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-medium text-slate-900">Документы</p>
                        {documents.length ? (
                          documents.map((item) => (
                            <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                name="requiredDocumentIds"
                                value={item.id}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <span>
                                {item.name} ({item.code})
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Нет типов документов.</p>
                        )}
                      </div>
                      <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-medium text-slate-900">Обучения</p>
                        {trainings.length ? (
                          trainings.map((item) => (
                            <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                name="requiredTrainingIds"
                                value={item.id}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <span>
                                {item.name} ({item.code})
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Нет типов обучения.</p>
                        )}
                      </div>
                      <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-medium text-slate-900">Инструктажи</p>
                        {instructions.length ? (
                          instructions.map((item) => (
                            <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                name="requiredInstructionIds"
                                value={item.id}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <span>
                                {item.name} ({item.code})
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Нет типов инструктажей.</p>
                        )}
                      </div>
                      <Textarea
                        name="notes"
                        className="min-h-24"
                        placeholder="Матрица требований для этой должности и контура допуска."
                      />
                      <button
                        type="submit"
                        className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-700"
                      >
                        Создать матрицу
                      </button>
                    </form>
                  ) : (
                    <EmptyState className="min-h-24 justify-center text-left">
                      Сначала создайте должности и типы документов.
                    </EmptyState>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
