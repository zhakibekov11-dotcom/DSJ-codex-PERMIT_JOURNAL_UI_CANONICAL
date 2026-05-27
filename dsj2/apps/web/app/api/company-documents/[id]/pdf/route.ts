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

  return proxyAuthenticatedBinaryDownload(`company-documents/${id}/pdf`, {
    fallbackContentType: "application/pdf",
    fallbackFileName: `company-document-${id}.pdf`,
    errorMessage: "Не удалось скачать PDF-файл документа.",
  });
}
