import { getApiUrl, getSessionToken } from "../../../../lib/api";

export async function POST(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const payload = await request.text();
  const response = await fetch(getApiUrl("biot-cards/generate-batch"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload,
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
