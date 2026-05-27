import "server-only";

import { getApiUrl, getSessionToken } from "./api";

const FORWARDED_BINARY_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-length",
  "content-type",
  "etag",
  "last-modified",
  "www-authenticate",
] as const;

function buildForwardedHeaders(source: Headers) {
  const headers = new Headers();

  for (const headerName of FORWARDED_BINARY_HEADERS) {
    const value = source.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function proxyAuthenticatedBinaryDownload(
  path: string,
  options: {
    fallbackContentType: string;
    fallbackFileName: string;
    errorMessage: string;
    unauthorizedMessage?: string;
  },
) {
  const token = await getSessionToken();

  if (!token) {
    return new Response(options.unauthorizedMessage ?? "Неавторизован", {
      status: 401,
    });
  }

  const upstream = await fetch(getApiUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const headers = buildForwardedHeaders(upstream.headers);

  if (upstream.ok) {
    if (!headers.has("content-type")) {
      headers.set("Content-Type", options.fallbackContentType);
    }

    if (!headers.has("content-disposition")) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${options.fallbackFileName}"`,
      );
    }
  } else if (!headers.has("content-type")) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }

  return new Response(
    upstream.body ?? (upstream.ok ? null : options.errorMessage),
    {
      status: upstream.status,
      headers,
    },
  );
}
