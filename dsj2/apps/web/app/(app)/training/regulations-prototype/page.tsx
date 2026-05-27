import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, PageHeader, Table, TableWrapper, Td, Th } from "@dsj/ui";
import { CompanySwitcher } from "@/components/company-switcher";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const regulatoryPrograms = [
  {
    code: "BIOT_WORKER",
    title: "БиОТ для работников",
    basis: "V1500012665",
    basisLabel: "Правила по безопасности и охране труда",
    appliesTo: "Новые сотрудники, переведенные сотрудники, подрядчики и посетители на производственных площадках",
    cadence: "Ежегодная проверка знаний; при приеме или переводе не позднее 1 месяца; повторный инструктаж не реже 1 раза в полугодие",
    delivery: "Вводный, первичный на рабочем месте, повторный, внеплановый, целевой инструктажи",
    outputs: [
      "Журнал вводного инструктажа",
      "Журнал инструктажа на рабочем месте",
      "Проверка знаний и допуск к работе",
      "Удостоверение после успешной проверки знаний",
    ],
  },
  {
    code: "BIOT_RESPONSIBLE",
    title: "БиОТ для руководителей и ответственных лиц",
    basis: "V1500012665",
    basisLabel: "Компетенции ответственных работников",
    appliesTo: "Руководители, специалисты и ответственные за безопасность и охрану труда",
    cadence: "Общие компетенции однократно; специальные компетенции 1 раз в 3 года",
    delivery: "Учебный центр, очно или дистанционно; тестирование с порогом 70%",
    outputs: [
      "График обучения ответственных работников",
      "Протокол экзаменационной комиссии",
      "Удостоверение по проверке знаний",
      "Привязка программы к категории риска и отрасли",
    ],
  },
  {
    code: "OPO_SAFETY",
    title: "Промышленная безопасность на ОПО",
    basis: "V2100023461",
    basisLabel: "Правила подготовки и проверки знаний в области промышленной безопасности",
    appliesTo: "Технические руководители, специалисты и работники, задействованные на опасных производственных объектах",
    cadence: "Ежегодные графики; новые сотрудники не позднее 1 месяца; повторная пересдача в течение 1 месяца",
    delivery: "10-часовые и 40-часовые программы, очно или дистанционно, с ПДЭК не менее 3 человек",
    outputs: [
      "Утвержденный график обучения и экзаменов",
      "Протокол ПДЭК с хранением 1 или 3 года",
      "Удостоверение, действующее по сроку в документе",
      "Апелляционный контур и история пересдач",
    ],
  },
  {
    code: "FIRE_PTM",
    title: "Пожарная безопасность и ПТМ",
    basis: "V1400009510",
    basisLabel: "Правила обучения мерам пожарной безопасности",
    appliesTo: "Ответственные за ПБ, объекты категорий А/Б, массовое пребывание людей, пожарная автоматика и персонал по внутренним программам",
    cadence: "Инструктаж по месту работы; ПТМ в учебном центре 1 раз в 3 года, без отрыва от производства не реже 1 раза в год",
    delivery: "Вводный, первичный, повторный, внеплановый, целевой противопожарный инструктаж и ПТМ",
    outputs: [
      "Журнал учета противопожарных инструктажей",
      "Протокол квалификационной комиссии",
      "Удостоверение по ПТМ для внешнего обучения",
      "Практика по эвакуации и средствам пожаротушения",
    ],
  },
] as const;

const sourceAudit = [
  {
    title: "V1500012665",
    status: "Используем как основу",
    tone: "green" as const,
    note: "Действующие правила по БиОТ. В Adilet зафиксированы изменения 2024 года.",
    href: "https://adilet.zan.kz/rus/docs/V1500012665",
  },
  {
    title: "V2100023461",
    status: "Используем как основу",
    tone: "green" as const,
    note: "Действующие правила по промышленной безопасности. В Adilet указаны редакции, вступившие в силу с 1 января 2026 года.",
    href: "https://adilet.zan.kz/rus/docs/V2100023461",
  },
  {
    title: "V1400009510",
    status: "Используем как основу",
    tone: "green" as const,
    note: "Действующие правила по пожарной безопасности и ПТМ. В Adilet отражены правки 2025 года.",
    href: "https://adilet.zan.kz/rus/docs/V1400009510",
  },
  {
    title: "Z020000314_",
    status: "Не берем как первоисточник",
    tone: "red" as const,
    note: "Закон утратил силу 11 апреля 2014 года. Для ОПО опираемся на закон о гражданской защите и действующие подзаконные акты.",
    href: "https://adilet.zan.kz/rus/docs/Z020000314_",
  },
  {
    title: "V970000523_",
    status: "Не берем как перечень профессий",
    tone: "red" as const,
    note: "Документ утратил силу 12 декабря 2004 года и не подходит как справочник профессий.",
    href: "https://adilet.zan.kz/rus/docs/V970000523_",
  },
] as const;

const employeeScenario = {
  employee: "Нурлан Сарсенов",
  jobTitle: "Оператор бурения, 5 разряд",
  department: "Буровой участок №2",
  site: "Куст 14, опасный производственный объект",
  conditions: [
    "Новый сотрудник на ОПО",
    "Работы с повышенной опасностью",
    "Площадка с огневыми работами по наряду-допуску",
    "Должность валидируется через ЕТКС",
  ],
  assignments: [
    {
      title: "Вводный инструктаж по БиОТ",
      status: "Нужно оформить сегодня",
      artifacts: "Журнал вводного инструктажа, подпись, допуск к первичному инструктажу",
    },
    {
      title: "Первичный инструктаж на рабочем месте",
      status: "Нужно оформить до допуска",
      artifacts: "Журнал на рабочем месте, практический показ, отметка о проверке знаний",
    },
    {
      title: "Промышленная безопасность на ОПО",
      status: "Нужно назначить в течение 1 месяца",
      artifacts: "10-часовая программа, экзамен, протокол ПДЭК, удостоверение",
    },
    {
      title: "Противопожарный инструктаж",
      status: "Нужно оформить до начала работы",
      artifacts: "Журнал противопожарного инструктажа, проверка навыков и путей эвакуации",
    },
    {
      title: "Целевой инструктаж на огневые работы",
      status: "Нужно оформлять под каждый наряд-допуск",
      artifacts: "Основание, номер наряда-допуска, запись в разрешающей документации",
    },
  ],
};

const journalColumns = [
  "Дата",
  "ФИО",
  "Профессия / должность",
  "Вид инструктажа",
  "Основание",
  "Инструктирующий",
  "Подпись сотрудника",
  "Подпись инструктирующего",
  "Следующий срок",
] as const;

const journalRows = [
  [
    "03.04.2026",
    "Нурлан Сарсенов",
    "Оператор бурения, 5 разряд",
    "Первичный на рабочем месте",
    "Прием на ОПО, участок бурения",
    "Есен Д.А.",
    "ЭЦП / подпись",
    "ЭЦП / подпись",
    "03.10.2026",
  ],
  [
    "03.04.2026",
    "Нурлан Сарсенов",
    "Оператор бурения, 5 разряд",
    "Противопожарный первичный",
    "Допуск к площадке, огневые риски",
    "Флеглер А.С.",
    "ЭЦП / подпись",
    "ЭЦП / подпись",
    "03.10.2026",
  ],
] as const;

const platformSettings = [
  "Утвержденные программы по БиОТ, ОПО, ПБ и ПТМ с юридическим основанием",
  "Составы комиссий: экзаменационная комиссия, ПДЭК, квалификационная комиссия",
  "Нумерация журналов, протоколов, удостоверений и нарядов-допусков",
  "Постоянные реквизиты компании, площадки, ОПО, ответственных лиц и учебного центра",
  "Матрица обязательности по профессии, разряду, типу объекта и виду работ",
];

const artifacts = [
  {
    title: "Журнал",
    text: "Система подставляет обязательные колонки и не дает закрыть запись без причин внепланового или основания целевого инструктажа.",
  },
  {
    title: "Экзамен",
    text: "Отдельно хранятся учебный тест и юридически значимый экзамен: версия вопросов, таймер, проходной балл, попытки и история пересдач.",
  },
  {
    title: "Протокол",
    text: "Фиксируется состав комиссии, дата, программа, итог, подписи и срок хранения в зависимости от типа программы.",
  },
  {
    title: "Удостоверение",
    text: "Короткий текст идет на корочку, полное правовое название остается в реестре, протоколе и выгрузке.",
  },
] as const;

export default async function RegulationsPrototypePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/training/regulations-prototype",
    searchParams: params,
  });

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <h1>Прототип нормативного режима обучения</h1>
          <p>
            Тестовый экран показывает, как обучение, журнал, экзамен и документы
            будут собираться по законам и правилам Республики Казахстан внутри DSJ.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CompanySwitcher
            pathname="/training/regulations-prototype"
            companies={companies}
            activeCompanyId={activeCompanyId}
            searchParams={params}
          />
          <Link
            href={`/training${activeCompanyId ? `?companyId=${activeCompanyId}` : ""}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-muted)]"
          >
            Вернуться к обучению
          </Link>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Контроль источников</h2>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {sourceAudit.map((item) => (
            <div key={item.title} className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--muted)] underline underline-offset-2"
                  >
                    Открыть в Adilet
                  </a>
                </div>
                <Badge tone={item.tone}>{item.status}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Нормативные программы</h2>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrapper className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Код</Th>
                  <Th>Программа</Th>
                  <Th>Кому назначается</Th>
                  <Th>Периодичность и срок</Th>
                  <Th>Формат</Th>
                </tr>
              </thead>
              <tbody>
                {regulatoryPrograms.map((program) => (
                  <tr key={program.code} className="border-t border-[var(--line)] align-top">
                    <Td>
                      <div className="space-y-2">
                        <div className="font-medium text-[var(--ink)]">{program.code}</div>
                        <Badge>{program.basis}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-2">
                        <p className="font-medium text-[var(--ink)]">{program.title}</p>
                        <p className="text-xs leading-5 text-[var(--muted)]">{program.basisLabel}</p>
                        <div className="space-y-1 pt-1">
                          {program.outputs.map((output) => (
                            <div key={output} className="text-xs leading-5 text-[var(--muted)]">
                              {output}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm leading-6 text-[var(--muted)]">{program.appliesTo}</Td>
                    <Td className="text-sm leading-6 text-[var(--muted)]">{program.cadence}</Td>
                    <Td className="text-sm leading-6 text-[var(--muted)]">{program.delivery}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Демо-маршрут сотрудника</h2>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--ink)]">{employeeScenario.employee}</p>
                <p className="text-sm text-[var(--muted)]">{employeeScenario.jobTitle}</p>
                <p className="text-sm text-[var(--muted)]">{employeeScenario.department}</p>
                <p className="text-sm text-[var(--muted)]">{employeeScenario.site}</p>
              </div>
              <div className="space-y-2">
                {employeeScenario.conditions.map((condition) => (
                  <div key={condition} className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                    {condition}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {employeeScenario.assignments.map((item, index) => (
                <div key={item.title} className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {index + 1}. {item.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.artifacts}</p>
                    </div>
                    <Badge tone="amber">{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Что станет постоянными значениями</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformSettings.map((item) => (
              <div key={item} className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-6 text-[var(--muted)]">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Заготовка нормативного журнала</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <p className="text-sm font-medium text-[var(--ink)]">
                Журнал в нормативном режиме больше не свободная заметка.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Система заранее знает тип журнала, набор колонок, необходимость
                причины внепланового инструктажа, связь с нарядом-допуском и
                обязательность подписей. Для электронного режима запись может быть
                заверена ЭЦП.
              </p>
            </div>

            <TableWrapper className="border border-[var(--line)]">
              <Table>
                <thead>
                  <tr>
                    {journalColumns.map((column) => (
                      <Th key={column}>{column}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {journalRows.map((row, index) => (
                    <tr key={`${row[0]}-${index}`} className="border-t border-[var(--line)]">
                      {row.map((cell) => (
                        <Td key={`${index}-${cell}`} className="text-xs leading-5 text-[var(--muted)]">
                          {cell}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Пакет артефактов</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {artifacts.map((artifact) => (
              <div key={artifact.title} className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--ink)]">{artifact.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{artifact.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
