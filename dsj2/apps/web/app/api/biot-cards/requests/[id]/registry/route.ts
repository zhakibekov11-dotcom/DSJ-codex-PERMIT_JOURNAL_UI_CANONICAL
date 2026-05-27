import { getApiUrl, getSessionToken } from "../../../../../../lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const { id } = await params;
  const response = await fetch(getApiUrl(`biot-cards/requests/${id}/export-registry`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const body = await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type") ?? "text/plain; charset=utf-8";
  const disposition = response.headers.get("Content-Disposition");

  return new Response(body, {
    status: response.status,
    headers: disposition
      ? {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
        }
      : {
          "Content-Type": contentType,
        },
  });
}
