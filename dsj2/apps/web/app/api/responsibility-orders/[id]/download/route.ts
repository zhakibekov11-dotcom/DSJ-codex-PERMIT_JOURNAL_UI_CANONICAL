import { getApiUrl, getSessionToken } from "../../../../../lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();
  const { id } = await params;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(getApiUrl(`responsibility-orders/${id}/download`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const buffer = await response.arrayBuffer();
  const headers = new Headers(response.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/pdf");
  }

  if (!headers.has("Content-Disposition")) {
    headers.set("Content-Disposition", `attachment; filename="responsibility-order-${id}.pdf"`);
  }

  return new Response(buffer, {
    status: response.status,
    headers,
  });
}
