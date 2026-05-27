import { getApiUrl, getSessionToken } from "../../../../lib/api";

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const url = new URL(request.url);
  const response = await fetch(
    `${getApiUrl("biot-cards/requests")}${url.search ? url.search : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}
