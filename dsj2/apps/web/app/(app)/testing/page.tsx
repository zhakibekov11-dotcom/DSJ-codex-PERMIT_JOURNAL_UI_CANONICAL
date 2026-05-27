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
import { createExamAction } from "@/actions/testing";
import { CompanySwitcher } from "@/components/company-switcher";
import { ExamQuestionBuilder } from "@/components/exam-question-builder";
import { SubmitButton } from "@/components/submit-button";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TestingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/testing",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const [exams, assignments] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        title: string;
        passingScore: number;
        maxAttempts: number;
        questionCount: number;
        attemptCount: number;
        trainingProgram: {
          id: string;
          title: string;
        };
      }>
    >(`exams${scopedQuery}`),
    apiFetch<
      Array<{
        trainingProgram: {
          id: string;
          title: string;
          description: string;
        };
        exam?: {
          examId: string;
        } | null;
      }>
    >(`training-assignments${scopedQuery}`),
  ]);

  const availablePrograms = Array.from(
    assignments.reduce((map, assignment) => {
      if (assignment.exam?.examId) {
        return map;
      }

      if (!map.has(assignment.trainingProgram.id)) {
        map.set(assignment.trainingProgram.id, assignment.trainingProgram);
      }

      return map;
    }, new Map<string, { id: string; title: string; description: string }>()),
  ).map(([, value]) => value);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Проверка знаний</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Тестирование</h1>
          <p className="mt-2 text-sm text-slate-500">
            Простые тесты по назначенным обучениям с проходным баллом, попытками и прозрачным результатом для сотрудника.
          </p>
        </div>
        <CompanySwitcher
          pathname="/testing"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Список тестов</h2>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Тест</Th>
                    <Th>Программа</Th>
                    <Th>Проходной балл</Th>
                    <Th>Попытки</Th>
                    <Th>Вопросы</Th>
                    <Th>Попыток сотрудников</Th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id} className="border-t border-slate-100">
                      <Td>{exam.title}</Td>
                      <Td>{exam.trainingProgram.title}</Td>
                      <Td>{exam.passingScore}%</Td>
                      <Td>{exam.maxAttempts}</Td>
                      <Td>{exam.questionCount}</Td>
                      <Td>{exam.attemptCount}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Создать тест</h2>
          </CardHeader>
          <CardContent>
            <form action={createExamAction} className="space-y-4">
              <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Программа обучения</label>
                <Select name="trainingProgramId" defaultValue="">
                  <option value="">Выберите программу</option>
                  {availablePrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Название теста</label>
                <Input name="title" placeholder="Проверка знаний по безопасной работе на высоте" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Описание</label>
                <Textarea
                  name="description"
                  rows={3}
                  placeholder="Коротко опишите, что именно проверяет тест."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Проходной балл, %</label>
                  <Input name="passingScore" type="number" min="1" max="100" defaultValue="80" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Максимум попыток</label>
                  <Input name="maxAttempts" type="number" min="1" max="10" defaultValue="3" required />
                </div>
              </div>

              <ExamQuestionBuilder />

              <SubmitButton label="Создать тест" pendingLabel="Сохранение..." />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
