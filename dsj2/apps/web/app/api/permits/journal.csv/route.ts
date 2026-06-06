import { getApiUrl, getSessionToken } from "@/lib/api";
import { getPermitJournalRow, type PermitPage } from "@/lib/permits";

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: string | null | undefined) {
  return value ?? "";
}

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  const companyId = params.get("companyId");
  if (companyId && !params.get("organizationId")) {
    params.set("organizationId", companyId);
  }
  params.delete("companyId");
  if (!params.get("pageSize")) {
    params.set("pageSize", "100");
  }

  const response = await fetch(
    getApiUrl(`core-platform/work-permits?${params.toString()}`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const page = (await response.json()) as PermitPage;
  const rows = [
    [
      "journalRegistrationNumber",
      "initialAdmissionAt",
      "repeatedAdmissionAt",
      "permitNumber",
      "issuer",
      "workDescription",
      "workplace",
      "workType",
      "status",
      "validUntil",
      "contractor",
      "closedAt",
      "archivedAt",
      "retentionUntil",
    ],
    ...page.items.map((permit) => {
      const journal = getPermitJournalRow(permit);
      return [
        journal.journalRegistrationNumber,
        csvDate(journal.initialAdmissionAt),
        csvDate(journal.repeatedAdmissionAt),
        journal.permitNumber,
        journal.issuer?.displayName ?? "",
        journal.workDescription,
        journal.workplace,
        journal.workType,
        journal.status,
        csvDate(journal.validUntil),
        journal.contractor?.displayName ?? "",
        csvDate(journal.closedAt),
        csvDate(journal.archivedAt),
        csvDate(journal.retentionUntil),
      ];
    }),
  ];
  const csv = rows
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="permit-journal.csv"',
    },
  });
}
