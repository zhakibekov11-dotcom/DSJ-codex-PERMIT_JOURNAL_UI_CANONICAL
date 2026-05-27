import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  TableWrapper,
  Td,
  Th,
} from "@dsj/ui";
import { formatDate } from "@dsj/utils";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyTestingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const exams = await apiFetch<
    Array<{
      assignmentId: string;
      trainingTitle: string;
      description: string | null;
      passingScore: number;
      dueAt: string | null;
      status: string;
      result: number | null;
      attemptsUsed: number;
      passedAt: string | null;
    }>
  >("exams/my");

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Тестирование</h1>
          <p className="mt-2 text-sm text-slate-500">
            Назначенные тесты, результаты попыток и итоговые статусы по связанным обучениям.
          </p>
        </div>
      </PageHeader>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Мои тесты</h2>
        </CardHeader>
        <CardContent className="p-0">
          {exams.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Тест</Th>
                    <Th>Срок</Th>
                    <Th>Проходной балл</Th>
                    <Th>Результат</Th>
                    <Th>Попытки</Th>
                    <Th>Статус</Th>
                    <Th>Открыть</Th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.assignmentId} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{exam.trainingTitle}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {exam.description ?? "Тест по назначенному обучению"}
                          </p>
                        </div>
                      </Td>
                      <Td>{exam.dueAt ? formatDate(exam.dueAt) : "Не задан"}</Td>
                      <Td>{exam.passingScore}%</Td>
                      <Td>{exam.result !== null ? `${exam.result}%` : "—"}</Td>
                      <Td>{exam.attemptsUsed}</Td>
                      <Td>
                        <StatusBadge value={exam.status} />
                      </Td>
                      <Td>
                        <Link
                          href={`/my-testing/${exam.assignmentId}`}
                          className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          Открыть
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Тесты появятся после назначения обучения с обязательной проверкой знаний.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
