import Link from "next/link";
import { Card, CardContent, CardHeader } from "@dsj/ui";
import { requireSession } from "@/lib/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isSigner = session.user.role === "EMPLOYEE_SIGNER";
  const missingEmployeeLink =
    isSigner && typeof params.reason === "string" && params.reason === "employee-link";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Ограничение доступа</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          {missingEmployeeLink ? "Аккаунт не привязан к сотруднику" : "Раздел недоступен для вашей роли"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {missingEmployeeLink
            ? "Для личного кабинета сотрудника нужна активная связь с карточкой сотрудника. Обратитесь к администратору компании."
            : isSigner
              ? "Для сотрудника административные разделы закрыты. Используйте раздел «Мои инструктажи» для прохождения, подтверждения ознакомления и подписи."
              : "У вашей текущей роли нет доступа к этому разделу."}
        </p>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-950">Что можно сделать дальше</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            {missingEmployeeLink
              ? "Администратор должен привязать ваш аккаунт к карточке сотрудника. До этого личные разделы недоступны."
              : "Если вам нужен доступ к журналу или административным страницам, обратитесь к администратору компании."}
          </p>
          <div className="flex flex-wrap gap-3">
            {!missingEmployeeLink ? (
              <Link
                href={isSigner ? "/my-instructions" : "/"}
                className="rounded-xl bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--surface-strong-hover)]"
              >
                {isSigner ? "К моим инструктажам" : "На главную"}
              </Link>
            ) : null}
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              {missingEmployeeLink ? "Выйти из аккаунта" : "Сменить пользователя"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
