import { getApiUrl, getSessionToken } from "../../../../../lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const response = await fetch(
    `${getApiUrl(`biot-cards/requests/${id}`)}${url.search ? url.search : ""}`,
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const { id } = await params;
  const payload = await request.text();
  const response = await fetch(getApiUrl(`biot-cards/requests/${id}/update`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: payload,
    cache: "no-store",
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Не авторизован", { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const response = await fetch(
    `${getApiUrl(`biot-cards/requests/${id}`)}${url.search ? url.search : ""}`,
    {
      method: "DELETE",
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
