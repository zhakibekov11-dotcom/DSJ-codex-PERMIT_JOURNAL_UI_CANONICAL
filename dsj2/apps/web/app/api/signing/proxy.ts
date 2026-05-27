import { getApiUrl, getSessionToken } from "@/lib/api";

export async function proxySigningRequest(path: string, request?: Request) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const idempotencyKey = request?.headers.get("idempotency-key");
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  const body =
    request && request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

  if (body) {
    headers.set("Content-Type", request?.headers.get("content-type") ?? "application/json");
  }

  const response = await fetch(getApiUrl(path), {
    method: request?.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  const responseBody = await response.arrayBuffer();
  const responseHeaders = new Headers(response.headers);

  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
