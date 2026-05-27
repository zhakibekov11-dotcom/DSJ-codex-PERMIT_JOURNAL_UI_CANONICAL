import { ShieldCheck, FileCheck2, Users2 } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/login-form";
import { getCurrentSession, getDefaultAuthenticatedPath } from "../../lib/auth";
import { demoPersonas } from "../../lib/demo-personas";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect(getDefaultAuthenticatedPath(session.user));
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <div className="mx-auto grid min-h-screen max-w-[1240px] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between border-b border-[var(--line)] px-6 py-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
          <div className="space-y-12">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-medium text-[var(--accent)]">
                Цифровой журнал по технике безопасности
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-[var(--ink)] lg:text-5xl">
                Журнал инструктажей, документы и контроль охраны труда в одном
                рабочем контуре.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
                Рабочая система для команд ОТ и ПБ: регистрация инструктажей,
                контроль статусов, подтверждения, личный кабинет сотрудника и
                выгрузки для проверки.
              </p>
            </div>

            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {[
              {
                icon: ShieldCheck,
                  title: "Разделение по компаниям и ролям",
                  text: "Каждый пользователь видит только свой контур и свои действия.",
                },
                {
                  icon: FileCheck2,
                  title: "Журнал, документы и история изменений",
                  text: "Выгрузки, подписи и подтверждения собраны без переключения между системами.",
                },
                {
                  icon: Users2,
                  title: "Один поток для офиса и сотрудников",
                  text: "Администраторы, инженеры и исполнители работают в общей, понятной структуре.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--accent-border)] bg-[var(--surface)] text-[var(--surface-strong)]">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-[var(--ink)]">
                      {item.title}
                    </p>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)] sm:grid-cols-3">
            <div>
              <p className="font-medium text-[var(--ink)]">Журнал</p>
              <p className="mt-1">
                Назначение, подписание и архив записей инструктажа.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--ink)]">Документы</p>
              <p className="mt-1">
                Удостоверения, протоколы и персональные выгрузки.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--ink)]">Личный кабинет</p>
              <p className="mt-1">
                Материалы, обучение и действия сотрудника без лишнего
                интерфейса.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-10 lg:px-12 lg:py-14">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                Вход в рабочее пространство
              </h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Используйте учётные данные вашей компании. Локальный seed-доступ
                доступен только если оператор явно настроил seed-учётные данные
                для этого окружения.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
              <LoginForm />
            </div>

            <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--surface-muted)] p-5">
              <p className="text-sm font-medium text-[var(--ink)]">Доступ seed</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <p>
                  Демо-персоны создаются только при намеренном локальном seed.
                  Для всех демо-персон используется пароль из{" "}
                  <code>SEED_COMPANY_ADMIN_PASSWORD</code>.
                </p>
                <div className="space-y-2">
                  {demoPersonas.map((account) => (
                    <div
                      key={account.email}
                      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                    >
                      <p className="font-medium text-[var(--ink)]">
                        {account.title}
                      </p>
                      <p>
                        <code>{account.email}</code>; маршрут:{" "}
                        {account.destination}
                      </p>
                    </div>
                  ))}
                </div>
                <p>
                  Для служебного администратора настройте{" "}
                  <code>SEED_SUPER_ADMIN_EMAIL</code> и{" "}
                  <code>SEED_SUPER_ADMIN_PASSWORD</code>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
