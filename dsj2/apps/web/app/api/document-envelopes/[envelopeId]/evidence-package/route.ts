import { getApiUrl, getSessionToken } from "../../../../../lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ envelopeId: string }> },
) {
  const token = await getSessionToken();
  const { envelopeId } = await params;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(
    getApiUrl(`core-platform/document-envelopes/${envelopeId}/evidence-package`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const buffer = await response.arrayBuffer();
  const headers = new Headers(response.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  headers.set(
    "Content-Disposition",
    `attachment; filename="evidence-package-${envelopeId}.json"`,
  );

  return new Response(buffer, {
    status: response.status,
    headers,
  });
}
