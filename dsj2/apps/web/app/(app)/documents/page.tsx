import {
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { createCompanyDocumentAction } from "@/actions/document";
import { CompanySwitcher } from "@/components/company-switcher";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const documentCategories = [
  {
    value: "LOCAL_ACT",
    label: "Локальные акты",
    description:
      "Базовые внутренние документы по системе управления охраной труда и перечням профессий.",
    presets: [
      "Положение о СУОТ",
      "Положение о службе охраны труда",
      "Перечень профессий, требующих инструктажей",
    ],
  },
  {
    value: "ORDER",
    label: "Приказы",
    description:
      "Приказы о назначении ответственных и распределении зон ответственности по охране труда.",
    presets: [
      "О назначении ответственных за охрану труда",
      "О назначении ответственных за пожарную безопасность",
      "О назначении ответственных за электробезопасность",
      "О назначении ответственных за проведение инструктажей",
    ],
  },
  {
    value: "INSTRUCTION",
    label: "Инструкции",
    description:
      "Инструкции по профессиям и видам работ: от электрика до работы на ПК и первой помощи.",
    presets: [
      "Инструкция по охране труда для электрика",
      "Инструкция по охране труда для офис-менеджера",
      "Инструкция по пожарной безопасности",
      "Инструкция по первой помощи",
      "Инструкция по работе на ПК",
    ],
  },
  {
    value: "JOURNAL",
    label: "Журналы",
    description:
      "Журналы вводного и рабочего инструктажа, учёта инструкций и регистрации несчастных случаев.",
    presets: [
      "Журнал вводного инструктажа",
      "Журнал инструктажа на рабочем месте",
      "Журнал учёта инструкций",
      "Журнал регистрации несчастных случаев",
    ],
  },
  {
    value: "TRAINING_CERTIFICATION",
    label: "Обучение и аттестация",
    description:
      "Протоколы проверки знаний, планы обучения и результаты специальной оценки условий труда.",
    presets: [
      "Протокол проверки знаний",
      "План обучения по охране труда",
      "Результаты СОУТ",
    ],
  },
] as const;

const actionLinkClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-muted)]";

function getDocumentPreview(summary: string | null, body: string) {
  const source = summary?.trim() || body.trim();

  if (source.length <= 180) {
    return source;
  }

  return `${source.slice(0, 177).trim()}...`;
}

export default async function DocumentsPage({
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
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const successMessage =
    typeof params.success === "string" ? params.success : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/documents",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const documents = await apiFetch<
    Array<{
      id: string;
      category: string;
      documentName: string;
      title: string;
      summary: string | null;
      body: string;
      issueDate: string | null;
      status: string;
      createdAt: string;
      updatedAt: string;
      createdByUserName: string;
    }>
  >(`company-documents${scopedQuery}`);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <h1>Документы</h1>
          <p>
            Реестр локальных актов, приказов, инструкций, журналов и материалов
            по обучению. Каждую запись можно вести как рабочий шаблон и
            выгружать в PDF или DOCX.
          </p>
        </div>
        <CompanySwitcher
          pathname="/documents"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-3 lg:grid-cols-5">
        {documentCategories.map((category) => {
          const count = documents.filter(
            (item) => item.category === category.value,
          ).length;

          return (
            <div
              key={category.value}
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                {category.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                {count}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">в реестре</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_24rem]">
        <div className="space-y-4">
          {documentCategories.map((category) => {
            const items = documents.filter(
              (item) => item.category === category.value,
            );

            return (
              <section
                key={category.value}
                className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]"
              >
                <div className="grid gap-4 border-b border-[var(--line)] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold text-[var(--ink)]">
                      {category.label}
                    </h2>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      {category.description}
                    </p>
                  </div>
                  <div className="space-y-2 rounded-md bg-[var(--surface-muted)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Базовый состав
                    </p>
                    <div className="space-y-1.5 text-sm text-[var(--ink)]">
                      {category.presets.map((preset) => (
                        <p key={preset}>{preset}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {items.length ? (
                  <div className="divide-y divide-[var(--line)]">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-[var(--ink)]">
                              {item.title}
                            </p>
                            <StatusBadge value={item.status} />
                          </div>
                          <p className="text-sm font-medium text-[var(--surface-strong)]">
                            {item.documentName}
                          </p>
                          <p className="text-sm leading-6 text-[var(--muted)]">
                            {getDocumentPreview(item.summary, item.body)}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                            <span>
                              {item.issueDate
                                ? `Дата документа: ${formatDate(item.issueDate)}`
                                : "Дата документа не указана"}
                            </span>
                            <span>Обновлено: {formatDateTime(item.updatedAt)}</span>
                            <span>Подготовил: {item.createdByUserName}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <a
                          href={`/api/company-documents/${item.id}/docx`}
                          className={actionLinkClass}
                        >
                            DOCX
                          </a>
                          <a
                            href={`/api/company-documents/${item.id}/pdf`}
                            className={actionLinkClass}
                          >
                            PDF
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-5">
                    <EmptyState className="min-h-24 items-start justify-center text-left">
                      В этом разделе пока нет документов. Добавьте первый шаблон
                      справа и он появится в реестре.
                    </EmptyState>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="h-fit overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="text-lg font-semibold text-[var(--ink)]">
              Добавить документ
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
              Сохраните сюда шаблон, положение, приказ или журнал. После
              добавления запись можно сразу выгрузить в PDF или DOCX.
            </p>
          </div>

          <form action={createCompanyDocumentAction} className="space-y-4 px-5 py-5">
            <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Категория
              </label>
              <Select name="category" defaultValue="LOCAL_ACT">
                {documentCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Вид документа
              </label>
              <Select name="documentName" defaultValue="Положение о СУОТ">
                {documentCategories.map((category) => (
                  <optgroup key={category.value} label={category.label}>
                    {category.presets.map((preset) => (
                      <option key={`${category.value}-${preset}`} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Название в реестре
              </label>
              <Input
                name="title"
                placeholder="Положение о системе управления охраной труда ТОО..."
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--ink)]">
                  Дата документа
                </label>
                <Input name="issueDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--ink)]">
                  Статус
                </label>
                <Select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">Черновик</option>
                  <option value="ACTIVE">Действует</option>
                  <option value="ARCHIVED">В архиве</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Краткое описание
              </label>
              <Input
                name="summary"
                placeholder="Для чего нужен документ и к какому процессу относится"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--ink)]">
                Содержание
              </label>
              <Textarea
                name="body"
                placeholder={
                  "1. Общие положения\n2. Ответственные лица\n3. Порядок проведения\n4. Контроль и пересмотр"
                }
                className="min-h-72"
                required
              />
            </div>

            <SubmitButton
              label="Добавить в реестр"
              pendingLabel="Сохраняем документ..."
              className="w-full"
            />
          </form>
        </aside>
      </div>
    </div>
  );
}
