import { getApiUrl, getSessionToken } from "@/lib/api";

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
    getApiUrl(`core-platform/work-permits/journal/pdf?${params.toString()}`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": 'attachment; filename="work-permit-journal.pdf"',
    },
  });
}
