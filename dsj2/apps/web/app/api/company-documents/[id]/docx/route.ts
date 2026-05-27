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

  return proxyAuthenticatedBinaryDownload(`company-documents/${id}/docx`, {
    fallbackContentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fallbackFileName: `company-document-${id}.docx`,
    errorMessage: "Не удалось скачать Word-файл документа.",
  });
}
