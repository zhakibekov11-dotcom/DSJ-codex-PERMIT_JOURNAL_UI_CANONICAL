import "server-only";

import { apiFetch } from "@/lib/api";
import type {
  PermitFormOptions,
  PermitOption,
  PermitPage,
  PermitRecord,
} from "@/lib/permits";

function scopedQuery(companyId: string | null | undefined) {
  return companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
}

function appendQuery(path: string, query: string, params: Record<string, string>) {
  const search = new URLSearchParams(query.startsWith("?") ? query.slice(1) : "");
  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }
  return `${path}?${search.toString()}`;
}

function option(
  id: string,
  label: string,
  sublabel?: string | null,
): PermitOption {
  return { id, label, sublabel: sublabel ?? null };
}

export async function fetchPermitFormOptions(
  companyId: string | null | undefined,
): Promise<PermitFormOptions> {
  const query = scopedQuery(companyId);
  const [
    employees,
    departments,
    workSites,
    contractors,
    contractorWorkers,
    contractorAccessActs,
    trainingAssignments,
    briefingEntries,
    employeeDocuments,
    safetyCertificates,
    qualificationDocuments,
    ppeIssues,
    documentEnvelopes,
  ] = await Promise.all([
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        employeeNumber: string;
        jobTitle?: string | null;
        status: string;
        department?: { name: string } | null;
      }>
    >(`employees${query}`),
    apiFetch<Array<{ id: string; name: string }>>(`departments${query}`),
    apiFetch<Array<{ id: string; name: string; location: string | null }>>(
      `core-platform/work-sites${query}`,
    ),
    apiFetch<
      Array<{ id: string; name: string; bin: string | null; isActive: boolean }>
    >(`core-platform/contractor-organizations${query}`),
    apiFetch<
      Array<{
        id: string;
        fullName: string;
        workerNumber: string;
        positionTitle: string | null;
        status: string;
        contractorOrganization: { name: string };
      }>
    >(`core-platform/contractor-workers${query}`),
    apiFetch<{
      items: Array<{
        id: string;
        actNumber: string;
        status: string;
        validFrom: string;
        validTo: string;
        workArea: string;
        contractorOrganizationId: string;
        contractorOrganization?: { name: string; bin: string | null };
      }>;
    }>(
      appendQuery("core-platform/contractor-access-acts", query, {
        activeOnly: "true",
        pageSize: "100",
      }),
    ),
    apiFetch<
      Array<{
        id: string;
        employeeId: string;
        status: string;
        completedAt: string | null;
        trainingProgram: { title: string; requiresExam: boolean };
        employee?: { fullName: string } | null;
      }>
    >(`training-assignments${query}`),
    apiFetch<
      Array<{
        id: string;
        employeeId: string;
        registrationNo: string | null;
        topic: string;
        status: string;
        briefingDate: string;
      }>
    >(`core-platform/briefing-journal-entries${query}`),
    apiFetch<
      Array<{
        id: string;
        employeeId: string;
        title: string;
        documentNumber: string | null;
        status: string;
        verificationStatus: string;
        expiryDate: string | null;
      }>
    >(`employee-documents${query}`),
    apiFetch<
      Array<{
        id: string;
        employeeId: string;
        certificateNumber: string;
        status: string;
        expiryDate: string;
      }>
    >(`safety-certificates${query}`),
    apiFetch<
      Array<{
        id: string;
        employeeId: string | null;
        contractorWorkerId: string | null;
        documentKind: string;
        documentNumber: string;
        status: string;
        expiryDate: string | null;
      }>
    >(`core-platform/qualification-documents${query}`),
    apiFetch<
      Array<{
        id: string;
        itemName: string;
        itemCode: string;
        status: string;
        employeeId: string | null;
        contractorWorkerId: string | null;
        validUntil: string | null;
      }>
    >(`core-platform/ppe-issues${query}`),
    apiFetch<
      Array<{
        id: string;
        documentNumber: string;
        title: string;
        documentKind: string;
        status: string;
      }>
    >(`core-platform/document-envelopes${query}`),
  ]);

  const certificateEvidence = [
    ...employeeDocuments.map((document) =>
      option(
        document.id,
        document.title,
        `${document.documentNumber ?? "без номера"} · ${document.status} · ${document.verificationStatus}`,
      ),
    ),
    ...safetyCertificates.map((certificate) =>
      option(
        certificate.id,
        certificate.certificateNumber,
        `${certificate.status} · до ${certificate.expiryDate.slice(0, 10)}`,
      ),
    ),
    ...qualificationDocuments
      .filter((document) => document.documentKind !== "MEDICAL_CLEARANCE")
      .map((document) =>
        option(
          document.id,
          document.documentNumber,
          `${document.documentKind} · ${document.status}`,
        ),
      ),
  ];

  return {
    employees: employees
      .filter((employee) => employee.status === "active")
      .map((employee) =>
        option(
          employee.id,
          employee.fullName,
          [
            employee.employeeNumber,
            employee.jobTitle,
            employee.department?.name,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
    contractorWorkers: contractorWorkers
      .filter((worker) => worker.status === "active")
      .map((worker) =>
        option(
          worker.id,
          worker.fullName,
          [
            worker.workerNumber,
            worker.positionTitle,
            worker.contractorOrganization.name,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
    departments: departments.map((department) =>
      option(department.id, department.name),
    ),
    workSites: workSites.map((workSite) =>
      option(workSite.id, workSite.name, workSite.location),
    ),
    contractors: contractors
      .filter((contractor) => contractor.isActive)
      .map((contractor) =>
        option(contractor.id, contractor.name, contractor.bin),
      ),
    contractorAccessActs: contractorAccessActs.items.map((act) =>
      option(
        act.id,
        `${act.actNumber} В· ${act.workArea}`,
        [
          act.contractorOrganization?.name ?? act.contractorOrganizationId,
          act.status,
          `${act.validFrom.slice(0, 10)} - ${act.validTo.slice(0, 10)}`,
        ]
          .filter(Boolean)
          .join(" В· "),
      ),
    ),
    trainingEvidence: trainingAssignments.map((assignment) =>
      option(
        assignment.id,
        assignment.trainingProgram.title,
        `${assignment.status}${assignment.completedAt ? ` · ${assignment.completedAt.slice(0, 10)}` : ""}`,
      ),
    ),
    briefingEvidence: briefingEntries.map((entry) =>
      option(
        entry.id,
        entry.topic,
        `${entry.registrationNo ?? "без номера"} · ${entry.status} · ${entry.briefingDate.slice(0, 10)}`,
      ),
    ),
    certificateEvidence,
    medicalEvidence: qualificationDocuments
      .filter((document) => document.documentKind === "MEDICAL_CLEARANCE")
      .map((document) =>
        option(
          document.id,
          document.documentNumber,
          `${document.status}${document.expiryDate ? ` · до ${document.expiryDate.slice(0, 10)}` : ""}`,
        ),
      ),
    requiredDocuments: [
      ...employeeDocuments.map((document) =>
        option(
          document.id,
          document.title,
          `${document.documentNumber ?? "без номера"} · ${document.status}`,
        ),
      ),
      ...qualificationDocuments.map((document) =>
        option(
          document.id,
          document.documentNumber,
          `${document.documentKind} · ${document.status}`,
        ),
      ),
      ...documentEnvelopes.map((document) =>
        option(
          document.id,
          document.title,
          `${document.documentKind} · ${document.documentNumber} · ${document.status}`,
        ),
      ),
    ],
    ppeIssues: ppeIssues.map((issue) =>
      option(
        issue.id,
        issue.itemName,
        `${issue.itemCode} · ${issue.status}${issue.validUntil ? ` · до ${issue.validUntil.slice(0, 10)}` : ""}`,
      ),
    ),
  };
}

export async function fetchPermit(permitId: string) {
  return apiFetch<PermitRecord>(`core-platform/work-permits/${permitId}`);
}

export async function fetchPermitPage(
  companyId: string | null | undefined,
  filters: Record<string, string | string[] | undefined> = {},
) {
  const params = new URLSearchParams();
  if (companyId) params.set("organizationId", companyId);
  for (const [key, rawValue] of Object.entries(filters)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) params.set(key, value);
  }
  return apiFetch<PermitPage>(
    `core-platform/work-permits${params.size ? `?${params.toString()}` : ""}`,
  );
}

export async function fetchPermits(companyId: string | null | undefined) {
  const page = await fetchPermitPage(companyId, { pageSize: "100" });
  return page.items;
}
