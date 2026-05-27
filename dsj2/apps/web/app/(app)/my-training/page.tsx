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
import { ProgressMeter } from "@/components/progress-meter";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyTrainingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRoleAccess(["EMPLOYEE_SIGNER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const assignments = await apiFetch<
    Array<{
      id: string;
      dueAt: string | null;
      status: string;
      progressPercent: number;
      trainingProgram: {
        title: string;
        description: string;
        requiresExam: boolean;
        createsDocument: boolean;
        createsSafetyCertificate: boolean;
      };
      exam?: {
        status: string;
      } | null;
    }>
  >("training-assignments/my");

  const activeAssignments = assignments.filter((assignment) => assignment.status !== "COMPLETED");
  const completedAssignments = assignments.filter((assignment) => assignment.status === "COMPLETED");
  const overdueAssignments = assignments.filter((assignment) => assignment.status === "OVERDUE").length;

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
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Обучение</h1>
          <p className="mt-2 text-sm text-slate-500">
            Назначенные программы обучения, материалы, прогресс и связь с обязательным тестированием.
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "Всего обучений", value: assignments.length },
          { label: "Активные", value: activeAssignments.length },
          { label: "Завершено", value: completedAssignments.length },
          { label: "Просрочено", value: overdueAssignments },
        ].map((metric) => (
          <Card key={metric.label} className="rounded-[24px]">
            <CardContent className="space-y-2 p-6">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="text-3xl font-semibold text-slate-950">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Назначенные обучения</h2>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length ? (
            <TableWrapper className="border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Программа</Th>
                    <Th>Срок</Th>
                    <Th>Статус</Th>
                    <Th>Прогресс</Th>
                    <Th>Следующий шаг</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-t border-slate-100">
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{assignment.trainingProgram.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {assignment.trainingProgram.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {assignment.trainingProgram.requiresExam ? "После материала требуется тест." : "Тест не обязателен."}
                          </p>
                        </div>
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
                          <Link
                            href={`/my-training/${assignment.id}`}
                            className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            Открыть
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          ) : (
            <div className="p-6">
              <EmptyState>Обучение появится здесь после назначения администратором или инженером по ТБ.</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
