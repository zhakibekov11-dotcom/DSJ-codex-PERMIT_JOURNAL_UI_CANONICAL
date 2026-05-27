import { getApiUrl, getSessionToken } from "../../../../lib/api";

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const { search } = new URL(request.url);
  const response = await fetch(`${getApiUrl("biot-cards/defaults")}${search}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json; charset=utf-8",
    },
  });
}
