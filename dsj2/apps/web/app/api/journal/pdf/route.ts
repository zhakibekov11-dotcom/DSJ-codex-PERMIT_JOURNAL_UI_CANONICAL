import { getApiUrl, getSessionToken } from "../../../../lib/api";

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const response = await fetch(
    getApiUrl(`briefing-records/export/journal.pdf${query ? `?${query}` : ""}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const buffer = await response.arrayBuffer();

  return new Response(buffer, {
    status: response.status,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="zhurnal-instruktazhey.pdf"',
    },
  });
}
