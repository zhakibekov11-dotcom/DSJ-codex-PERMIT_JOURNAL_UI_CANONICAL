import "server-only";

import { apiFetch } from "@/lib/api";
import type { PermitOption, PermitRecord } from "@/lib/permits";

function scopedQuery(companyId: string | null | undefined) {
  return companyId ? `?companyId=${companyId}` : "";
}

export async function fetchPermitFormOptions(companyId: string | null | undefined) {
  const query = scopedQuery(companyId);
  const [employees, departments, workSites, contractors] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        employeeKind: string;
        jobTitle?: string | null;
        department?: { name: string } | null;
      }>
    >(`employees${query}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${query}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(
      `core-platform/work-sites${query}`,
    ),
    apiFetch<
      Array<{
        id: string;
        name: string;
        bin: string | null;
        isActive: boolean;
      }>
    >(`contractor-companies${query}`),
  ]);

  return {
    employees: employees.map<PermitOption>((employee) => ({
      id: employee.id,
      label: employee.fullName,
      sublabel: [
        employee.employeeNumber,
        employee.employeeKind === "CONTRACTOR" ? "подрядчик" : employee.jobTitle,
        employee.department?.name,
      ]
        .filter(Boolean)
        .join(" • "),
    })),
    departments: departments.map<PermitOption>((department) => ({
      id: department.id,
      label: department.name,
    })),
    workSites: workSites.map<PermitOption>((workSite) => ({
      id: workSite.id,
      label: workSite.name,
      sublabel: workSite.location,
    })),
    contractors: contractors
      .filter((contractor) => contractor.isActive)
      .map<PermitOption>((contractor) => ({
        id: contractor.id,
        label: contractor.name,
        sublabel: contractor.bin,
      })),
  };
}

export async function fetchPermit(permitId: string) {
  return apiFetch<PermitRecord>(`core-platform/work-permits/${permitId}`);
}

export async function fetchPermits(companyId: string | null | undefined) {
  return apiFetch<PermitRecord[]>(`core-platform/work-permits${scopedQuery(companyId)}`);
}
