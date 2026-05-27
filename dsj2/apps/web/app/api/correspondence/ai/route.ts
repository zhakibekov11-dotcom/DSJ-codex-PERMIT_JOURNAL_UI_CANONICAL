import { NextResponse } from "next/server";
import { getApiUrl, getSessionToken } from "@/lib/api";

function normalizeErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const data = payload as { message?: string | string[]; error?: string };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    if (typeof data.message === "string") {
      return data.message;
    }

    if (typeof data.error === "string") {
      return data.error;
    }
  }

  return fallback;
}

export async function POST(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ message: "Требуется авторизация." }, { status: 401 });
  }

  const body = await request.text();
  const response = await fetch(getApiUrl("correspondence/ai-assist"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      message = normalizeErrorMessage(payload, message);
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    return NextResponse.json({ message }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
