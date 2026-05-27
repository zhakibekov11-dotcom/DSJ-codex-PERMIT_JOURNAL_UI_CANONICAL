import { proxyAuthenticatedBinaryDownload } from "@/lib/binary-proxy";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await context.params;

  return proxyAuthenticatedBinaryDownload(`correspondence/${id}/pdf`, {
    fallbackContentType: "application/pdf",
    fallbackFileName: `correspondence-${id}.pdf`,
    errorMessage: "Не удалось скачать письмо.",
  });
}
