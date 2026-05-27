import { getApiUrl, getSessionToken } from "../../../../../lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();
  const { id } = await params;

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const response = await fetch(getApiUrl(`briefing-records/${id}/export/pdf`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const buffer = await response.arrayBuffer();

  return new Response(buffer, {
    status: response.status,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="instruktazh-${id}.pdf"`,
    },
  });
}
