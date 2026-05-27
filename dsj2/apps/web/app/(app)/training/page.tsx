import {
  Card,
  CardContent,
  CardHeader,
  Input,
  PageHeader,
  Table,
  TableWrapper,
  Td,
  Textarea,
  Th,
} from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import Link from "next/link";
import { createTrainingAction } from "@/actions/training";
import { BriefingParticipantPicker } from "@/components/briefing-participant-picker";
import { CompanySwitcher } from "@/components/company-switcher";
import { ProgressMeter } from "@/components/progress-meter";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TrainingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/training",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const [assignments, employees] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        dueAt: string | null;
        status: string;
        progressPercent: number;
        employee: {
          fullName: string;
          employeeNumber: string;
        };
        trainingProgram: {
          id: string;
          title: string;
          requiresExam: boolean;
          createsDocument: boolean;
          createsSafetyCertificate: boolean;
        };
        exam?: {
          status: string;
        } | null;
      }>
    >(`training-assignments${scopedQuery}`),
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        contractorCompany?: { name: string } | null;
      }>
    >(`employees${scopedQuery}`),
  ]);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Развитие сотрудника</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Обучение</h1>
          <p className="mt-2 text-sm text-slate-500">
            Назначение программ обучения, публикация материалов и контроль прогресса по сотрудникам.
          </p>
        </div>
        <CompanySwitcher
          pathname="/training"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-950">
              Тестовый прототип нормативного режима
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Отдельный экран показывает, как обучение, журнал, экзамен и документы
              будут собираться по нормам РК: БиОТ, промышленная безопасность на ОПО,
              пожарная безопасность и ПТМ.
            </p>
          </div>
          <Link
            href={`/training/regulations-prototype${activeCompanyId ? `?companyId=${activeCompanyId}` : ""}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--accent-border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-muted)]"
          >
            Открыть прототип
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Назначенные обучения</h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Программа</Th>
                    <Th>Сотрудник</Th>
                    <Th>Срок</Th>
                    <Th>Статус</Th>
                    <Th>Прогресс</Th>
                    <Th>Связи</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{assignment.trainingProgram.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {assignment.trainingProgram.requiresExam ? "С тестом" : "Без теста"}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        {assignment.employee.fullName}
                        <p className="mt-1 text-xs text-slate-400">{assignment.employee.employeeNumber}</p>
                      </Td>
                      <Td>{assignment.dueAt ? formatDate(assignment.dueAt) : "Не задан"}</Td>
                      <Td>
                        <StatusBadge value={assignment.status} />
                      </Td>
                      <Td className="min-w-[180px]">
                        <ProgressMeter value={assignment.progressPercent} />
                      </Td>
                      <Td>
                        <div className="space-y-2">
                          {assignment.exam ? <StatusBadge value={assignment.exam.status} /> : null}
                          <p className="text-xs text-slate-500">
                            {assignment.trainingProgram.createsDocument ? "Документ" : "Без документа"}
                            {" • "}
                            {assignment.trainingProgram.createsSafetyCertificate ? "Удостоверение" : "Без удостоверения"}
                          </p>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Назначить обучение</h2>
          </CardHeader>
          <CardContent>
            <form action={createTrainingAction} className="space-y-4">
              <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Название программы</label>
                <Input name="title" placeholder="Обучение по безопасной работе на высоте" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Краткое описание</label>
                <Textarea
                  name="description"
                  rows={4}
                  placeholder="Цель, область применения и ожидаемый результат обучения"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Материал обучения</label>
                <Textarea
                  name="materialContent"
                  rows={6}
                  placeholder="Краткое содержание шагов обучения, ключевые правила и чек-лист сотрудника"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Имя вложения</label>
                  <Input name="materialFileName" placeholder="working-at-height.pdf" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Ссылка на файл</label>
                  <Input name="materialFileUrl" placeholder="https://files.example.kz/training.pdf" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Видео (опционально)</label>
                  <Input name="videoUrl" placeholder="https://video.example.kz/module-1" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Срок прохождения</label>
                  <Input name="dueAt" type="date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Организация / эмитент</label>
                <Input name="issuerName" placeholder="Учебный центр Alpina HSE" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3">
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" name="requiresExam" className="mt-1 h-4 w-4 rounded border-slate-300" />
                    <span>После обучения требуется тестирование</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" name="createsDocument" className="mt-1 h-4 w-4 rounded border-slate-300" />
                    <span>После завершения выпустить документ сотрудника</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="createsSafetyCertificate"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span>После завершения выпустить удостоверение по ТБ</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Назначить сотрудникам</label>
                <BriefingParticipantPicker
                  employees={employees}
                  availableTitle="Добавить сотрудников в обучение"
                  availableDescription="Ищи по ФИО, табельному номеру, типу занятости или подрядной компании."
                  selectedTitle="Выбранные сотрудники"
                  selectedDescription="Здесь можно убрать лишних перед сохранением назначения."
                  selectedEmptyState="Выберите хотя бы одного сотрудника для назначения обучения."
                  searchPlaceholder="Поиск сотрудника"
                />
              </div>

              <SubmitButton label="Назначить обучение" pendingLabel="Сохранение..." />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
