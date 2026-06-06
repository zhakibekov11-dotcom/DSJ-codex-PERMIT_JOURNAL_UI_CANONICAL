import { getApiUrl, getSessionToken } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();
  const { id } = await params;

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const response = await fetch(
    getApiUrl(`core-platform/work-permits/${id}/evidence`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="work-permit-${id}-evidence.json"`,
    },
  });
}
