"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { UserRole } from "@dsj/types";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "../actions/auth";
import { getDemoPersonaForEmail } from "../lib/demo-personas";
import { roleLabels } from "../lib/labels";

type AppShellProps = {
  role: UserRole;
  hasLinkedEmployeeRecord?: boolean;
  companyName: string | null;
  fullName: string;
  email: string;
  children: ReactNode;
};

const storageKey = "dsj-sidebar-collapsed";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navigationByRole = {
  SUPER_ADMIN: [
    { href: "/dashboard", label: "Панель", icon: LayoutDashboard },
    { href: "/companies", label: "Компании", icon: Building2 },
    { href: "/contractors", label: "Подрядчики", icon: BriefcaseBusiness },
    { href: "/departments", label: "Подразделения", icon: ListChecks },
    { href: "/employees", label: "Сотрудники", icon: Users },
    { href: "/compliance", label: "Правила допуска", icon: Shield },
    { href: "/journal", label: "Журнал", icon: ClipboardList },
    { href: "/permits", label: "Журнал допусков", icon: ClipboardCheck },
    { href: "/protocols", label: "Протоколы", icon: FileCheck },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/certificates", label: "Удостоверения", icon: BadgeCheck },
    { href: "/correspondence", label: "Переписка", icon: Mail },
    { href: "/training", label: "Обучение", icon: GraduationCap },
    { href: "/testing", label: "Тестирование", icon: ClipboardCheck },
    { href: "/audit", label: "Аудит", icon: Shield },
  ],
  COMPANY_ADMIN: [
    { href: "/dashboard", label: "Панель", icon: LayoutDashboard },
    { href: "/companies", label: "Компании", icon: Building2 },
    { href: "/contractors", label: "Подрядчики", icon: BriefcaseBusiness },
    { href: "/departments", label: "Подразделения", icon: ListChecks },
    { href: "/employees", label: "Сотрудники", icon: Users },
    { href: "/compliance", label: "Правила допуска", icon: Shield },
    { href: "/journal", label: "Журнал", icon: ClipboardList },
    { href: "/permits", label: "Журнал допусков", icon: ClipboardCheck },
    { href: "/protocols", label: "Протоколы", icon: FileCheck },
    { href: "/orders/responsibility", label: "Приказы о назначении", icon: Shield },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/certificates", label: "Удостоверения", icon: BadgeCheck },
    { href: "/correspondence", label: "Переписка", icon: Mail },
    { href: "/training", label: "Обучение", icon: GraduationCap },
    { href: "/testing", label: "Тестирование", icon: ClipboardCheck },
    { href: "/audit", label: "Аудит", icon: Shield },
  ],
  SAFETY_ENGINEER: [
    { href: "/dashboard", label: "Панель", icon: LayoutDashboard },
    { href: "/companies", label: "Компании", icon: Building2 },
    { href: "/contractors", label: "Подрядчики", icon: BriefcaseBusiness },
    { href: "/departments", label: "Подразделения", icon: ListChecks },
    { href: "/employees", label: "Сотрудники", icon: Users },
    { href: "/compliance", label: "Правила допуска", icon: Shield },
    { href: "/journal", label: "Журнал", icon: ClipboardList },
    { href: "/permits", label: "Журнал допусков", icon: ClipboardCheck },
    { href: "/protocols", label: "Протоколы", icon: FileCheck },
    { href: "/orders/responsibility", label: "Приказы о назначении", icon: Shield },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/certificates", label: "Удостоверения", icon: BadgeCheck },
    { href: "/correspondence", label: "Переписка", icon: Mail },
    { href: "/training", label: "Обучение", icon: GraduationCap },
    { href: "/testing", label: "Тестирование", icon: ClipboardCheck },
    { href: "/audit", label: "Аудит", icon: Shield },
  ],
  EMPLOYEE_SIGNER: [
    { href: "/my-instructions", label: "Мои инструктажи", icon: ClipboardList },
    { href: "/my-documents", label: "Мои документы", icon: FileText },
    { href: "/my-certificates", label: "Мои удостоверения", icon: FileCheck },
    { href: "/my-training", label: "Моё обучение", icon: GraduationCap },
    { href: "/my-testing", label: "Моё тестирование", icon: ClipboardCheck },
  ],
} as const satisfies Record<UserRole, NavigationItem[]>;

const directorNavigationHrefs = new Set([
  "/dashboard",
  "/employees",
  "/journal",
  "/permits",
  "/audit",
]);

const shopChiefNavigationHrefs = new Set([
  "/dashboard",
  "/employees",
  "/journal",
  "/orders/responsibility",
]);

const safetyEngineerNavigationHrefs = new Set([
  "/dashboard",
  "/contractors",
  "/departments",
  "/employees",
  "/compliance",
  "/journal",
  "/permits",
  "/protocols",
  "/orders/responsibility",
  "/documents",
  "/certificates",
  "/training",
  "/testing",
  "/audit",
]);

function shapeNavigationForDemoPersona(
  email: string,
  role: UserRole,
  navigation: readonly NavigationItem[],
) {
  const persona = getDemoPersonaForEmail(email);

  if (!persona || role === "EMPLOYEE_SIGNER") {
    return navigation;
  }

  if (persona.key === "director") {
    return navigation.filter((item) => directorNavigationHrefs.has(item.href));
  }

  if (persona.key === "shop-chief") {
    return navigation.filter((item) => shopChiefNavigationHrefs.has(item.href));
  }

  if (persona.key === "safety-engineer") {
    return navigation.filter((item) =>
      safetyEngineerNavigationHrefs.has(item.href),
    );
  }

  return navigation;
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "DS"
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  role,
  hasLinkedEmployeeRecord,
  companyName,
  fullName,
  email,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const demoPersona = getDemoPersonaForEmail(email);
  const navigation =
    role === "EMPLOYEE_SIGNER" && hasLinkedEmployeeRecord === false
      ? []
      : shapeNavigationForDemoPersona(email, role, navigationByRole[role] ?? []);

  useEffect(() => {
    const savedState = window.localStorage.getItem(storageKey);
    setIsCollapsed(savedState === "1");
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  function toggleSidebar() {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--shell-border)] bg-[var(--shell-bg)] px-3 text-[var(--shell-text)] shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel)] text-[var(--shell-text)] transition-colors duration-150 hover:bg-[var(--shell-hover)]"
          aria-label="Открыть меню"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Цифровой журнал по технике безопасности</p>
          <p className="truncate text-xs text-[var(--shell-muted)]">
            {companyName ?? "Общее рабочее пространство"}
          </p>
        </div>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel-strong)] text-xs font-semibold text-[var(--shell-text)]"
          title={`${fullName} • ${roleLabels[role] ?? role}`}
        >
          {getInitials(fullName)}
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Навигация"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/45"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Закрыть меню"
          />

          <aside className="relative flex h-full w-[min(88vw,320px)] flex-col overflow-y-auto border-r border-[var(--shell-border)] bg-[var(--shell-bg)] px-4 py-5 text-[var(--shell-text)] shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h1 className="text-base font-semibold text-[var(--shell-text)]">
                  Цифровой журнал по технике безопасности
                </h1>
                <p className="text-sm text-[var(--shell-muted)]">
                  {companyName ?? "Общее рабочее пространство"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel)] text-[var(--shell-text)] transition-colors duration-150 hover:bg-[var(--shell-hover)]"
                aria-label="Закрыть меню"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-panel)] p-4">
              <p className="text-sm font-medium text-[var(--shell-text)]">{fullName}</p>
              <p className="mt-1 text-sm text-[var(--shell-muted)]">
                {demoPersona?.title ?? roleLabels[role] ?? role}
              </p>
              {demoPersona ? (
                <p className="mt-1 text-xs text-[var(--shell-subtle)]">
                  {demoPersona.scopeLabel}
                </p>
              ) : null}
              <p className="mt-3 break-all text-sm text-[var(--shell-subtle)]">{email}</p>
            </div>

            <nav className="mt-5 flex-1 space-y-1">
              {navigation.length ? (
                navigation.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-3 text-sm transition-colors duration-150",
                        active
                          ? "border-transparent bg-[var(--shell-active)] text-[var(--shell-text)]"
                          : "border-transparent text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-panel)] p-4 text-sm text-[var(--shell-muted)]">
                  {role === "EMPLOYEE_SIGNER" && hasLinkedEmployeeRecord === false
                    ? "Аккаунт сотрудника еще не связан с карточкой сотрудника. Обратитесь к администратору компании."
                    : "Эта роль работает только с прямыми ссылками на документы и подписание."}
                </div>
              )}
            </nav>

            <form action={logoutAction} className="mt-5 border-t border-[var(--shell-border)] pt-4">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel)] px-3 py-2.5 text-sm text-[var(--shell-text)] transition-colors duration-150 hover:bg-[var(--shell-hover)]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Выйти</span>
              </button>
            </form>
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-h-[calc(100vh-4rem)] lg:min-h-screen",
          isCollapsed
            ? "lg:grid-cols-[84px_minmax(0,1fr)]"
            : "lg:grid-cols-[248px_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "hidden border-r border-[var(--shell-border)] bg-[var(--shell-bg)] py-6 text-[var(--shell-text)] lg:block",
            isCollapsed ? "px-3" : "px-4 lg:px-5",
          )}
        >
          <div className="space-y-5">
            <div
              className={cn(
                "gap-3",
                isCollapsed ? "flex flex-col items-center" : "flex items-start justify-between",
              )}
            >
              <div className={cn("min-w-0", isCollapsed ? "text-center" : "space-y-2")}>
                <h1 className="text-lg font-semibold text-[var(--shell-text)]">
                  {isCollapsed ? "DSJ" : "Цифровой журнал по технике безопасности"}
                </h1>
                {!isCollapsed ? (
                  <p className="text-sm text-[var(--shell-muted)]">
                    {companyName ?? "Общее рабочее пространство"}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel)] text-[var(--shell-text)] transition-colors duration-150 hover:bg-[var(--shell-hover)]"
                aria-label={isCollapsed ? "Развернуть панель" : "Свернуть панель"}
                title={isCollapsed ? "Развернуть панель" : "Свернуть панель"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>

            {isCollapsed ? (
              <div className="flex justify-center">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel-strong)] text-sm font-semibold text-[var(--shell-text)]"
                  title={`${fullName} • ${roleLabels[role] ?? role}`}
                >
                  {getInitials(fullName)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-panel)] p-4">
                <p className="text-sm font-medium text-[var(--shell-text)]">{fullName}</p>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  {demoPersona?.title ?? roleLabels[role] ?? role}
                </p>
                {demoPersona ? (
                  <p className="mt-1 text-xs text-[var(--shell-subtle)]">
                    {demoPersona.scopeLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-[var(--shell-subtle)]">{email}</p>
              </div>
            )}
          </div>

          <nav className="mt-6 space-y-1">
            {navigation.length ? (
              navigation.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex rounded-md border text-sm transition-colors duration-150",
                      active
                        ? "border-transparent bg-[var(--shell-active)] text-[var(--shell-text)]"
                        : "border-transparent text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]",
                      isCollapsed
                        ? "mx-auto h-10 w-10 items-center justify-center"
                        : "items-center gap-3 px-3 py-2.5",
                    )}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })
            ) : (
              <div
                className={cn(
                  "rounded-lg border border-[var(--shell-border)] bg-[var(--shell-panel)] text-sm text-[var(--shell-muted)]",
                  isCollapsed ? "p-2 text-center text-xs" : "p-4",
                )}
              >
                {isCollapsed
                  ? "..."
                  : role === "EMPLOYEE_SIGNER" && hasLinkedEmployeeRecord === false
                    ? "Аккаунт сотрудника еще не связан с карточкой сотрудника. Обратитесь к администратору компании."
                    : "Эта роль работает только с прямыми ссылками на документы и подписание."}
              </div>
            )}
          </nav>

          <form action={logoutAction} className={cn("mt-6", isCollapsed ? "flex justify-center" : "")}>
            <button
              type="submit"
              className={cn(
                "inline-flex items-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-panel)] text-sm text-[var(--shell-text)] transition-colors duration-150 hover:bg-[var(--shell-hover)]",
                isCollapsed ? "h-10 w-10 justify-center" : "gap-2 px-3 py-2",
              )}
              title={isCollapsed ? "Выйти" : undefined}
              aria-label={isCollapsed ? "Выйти" : undefined}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed ? <span>Выйти</span> : null}
            </button>
          </form>
        </aside>

        <main className="min-w-0 px-4 py-5 md:px-8 md:py-6">
          <div className="mx-auto w-full max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
