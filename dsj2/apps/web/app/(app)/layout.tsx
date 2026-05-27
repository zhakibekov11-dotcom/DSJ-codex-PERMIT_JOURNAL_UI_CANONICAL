import { redirect } from "next/navigation";
import type { UserRole } from "@dsj/types";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "../../lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  if (!session.user) {
    redirect("/login");
  }

  return (
    <AppShell
      role={session.user.role as UserRole}
      hasLinkedEmployeeRecord={session.user.hasLinkedEmployeeRecord}
      companyName={
        session.user.company?.name ?? "Платформенное рабочее пространство"
      }
      fullName={session.user.fullName}
      email={session.user.email}
    >
      {children}
    </AppShell>
  );
}
