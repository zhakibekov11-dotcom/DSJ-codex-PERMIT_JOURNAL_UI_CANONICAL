import { NextResponse } from "next/server";
import { apiFetch, getSessionToken } from "@/lib/api";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";

type EmployeeCandidate = {
  id: string;
  fullName: string;
  employeeNumber: string;
  employeeKind: string;
  accountEmail?: string | null;
  accountRole?: string | null;
  hasEmployeeSignerAccount?: boolean;
  department?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
  contractorCompany?: { name: string } | null;
};

type RouteSessionUser = {
  email: string;
  role: string;
};

function isAllowedRole(role: string) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "SAFETY_ENGINEER";
}

function matchesDemoPersonaScope(
  employee: EmployeeCandidate,
  persona: ReturnType<typeof getDemoPersonaForEmail>,
) {
  if (persona?.key !== "shop-chief") {
    return true;
  }

  return (
    employee.department?.name === persona.scopeDepartmentName &&
    employee.site?.name === persona.scopeSiteName
  );
}

function canCompleteEmployeeSignature(employee: EmployeeCandidate) {
  return employee.hasEmployeeSignerAccount === true;
}

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let user: RouteSessionUser;

  try {
    user = await apiFetch<RouteSessionUser>("auth/me", undefined, { token });
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isAllowedRole(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = new URLSearchParams();
  const companyId = url.searchParams.get("companyId");
  const search = url.searchParams.get("search")?.trim();

  if (companyId) {
    query.set("companyId", companyId);
  }

  if (search) {
    query.set("search", search);
  }

  query.set("status", "active");

  const employees = await apiFetch<EmployeeCandidate[]>(
    `employees?${query.toString()}`,
    undefined,
    { token },
  );
  const persona = getDemoPersonaForEmail(user.email);
  const candidates = employees
    .filter((employee) => matchesDemoPersonaScope(employee, persona))
    .filter(canCompleteEmployeeSignature);

  return NextResponse.json(candidates, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
