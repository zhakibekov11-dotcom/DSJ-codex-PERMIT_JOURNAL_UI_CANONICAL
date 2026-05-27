import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { CompanySwitcher } from "@/components/company-switcher";
import { CorrespondenceEditor } from "@/components/correspondence-editor";
import { StatusBadge } from "@/components/status-badge";
import { sendCorrespondenceAction } from "@/actions/correspondence";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { resolveCompanyContext } from "@/lib/company-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const kindLabels: Record<string, string> = {
  LETTER: "Деловое письмо",
  COMMERCIAL_PROPOSAL: "Коммерческое предложение",
};

export default async function CorrespondencePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const params = await searchParams;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const successMessage = typeof params.success === "string" ? params.success : null;
  const { companies, activeCompanyId } = await resolveCompanyContext({
    session,
    pathname: "/correspondence",
    searchParams: params,
  });
  const scopedQuery = activeCompanyId ? `?companyId=${activeCompanyId}` : "";

  const correspondences = await apiFetch<
    Array<{
      id: string;
      registryNumber: string;
      title: string;
      kind: string;
      subject: string;
      status: string;
      createdAt: string;
      sentAt: string | null;
      createdByUserName: string;
      wordTemplateAvailable: boolean;
      recipientsCount: number;
      recipients: Array<{
        id: string;
        companyName: string;
        contactName: string;
        contactEmail: string | null;
        contactPosition: string | null;
        status: string;
        sentAt: string | null;
        lastError: string | null;
      }>;
    }>
  >(`correspondence${scopedQuery}`);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Исходящая переписка</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Письма и коммерческие предложения</h1>
          <p className="mt-2 text-sm text-slate-500">
            Подготовка деловых писем, коммерческих предложений, реестр отправок и AI-помощник для редактуры.
          </p>
        </div>
        <CompanySwitcher
          pathname="/correspondence"
          companies={companies}
          activeCompanyId={activeCompanyId}
          searchParams={params}
        />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Реестр писем и КП</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {correspondences.length ? (
              correspondences.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.registryNumber}</p>
                      <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.subject}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{kindLabels[item.kind] ?? item.kind}</span>
                        <span>•</span>
                        <span>Получателей: {item.recipientsCount}</span>
                        <span>•</span>
                        <span>Создал: {item.createdByUserName}</span>
                        <span>•</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                        <span>•</span>
                        <span>{item.sentAt ? `Отправлено ${formatDate(item.sentAt)}` : "Ещё не отправлено"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <StatusBadge value={item.status} />
                      <div className="flex flex-wrap gap-2">
                        {item.wordTemplateAvailable ? (
                          <a
                            href={`/api/correspondence/${item.id}/docx`}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
                          >
                            Скачать DOCX
                          </a>
                        ) : null}
                        <a
                          href={`/api/correspondence/${item.id}/pdf`}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
                        >
                          Скачать PDF
                        </a>
                        <form action={sendCorrespondenceAction}>
                          <input type="hidden" name="companyId" value={activeCompanyId ?? ""} />
                          <input type="hidden" name="correspondenceId" value={item.id} />
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white"
                          >
                            Отправить всем
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <details className="mt-4 rounded-2xl border border-slate-200 bg-white/90">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700">
                      Получатели и даты отправки
                    </summary>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <div className="space-y-3">
                        {item.recipients.map((recipient) => (
                          <div key={recipient.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="font-medium text-slate-900">{recipient.companyName}</p>
                                <p className="text-sm text-slate-600">
                                  {recipient.contactName}
                                  {recipient.contactPosition ? `, ${recipient.contactPosition}` : ""}
                                </p>
                                <p className="text-xs text-slate-500">{recipient.contactEmail ?? "Email не указан"}</p>
                              </div>
                              <div className="flex flex-col gap-1 lg:items-end">
                                <StatusBadge value={recipient.status} />
                                <p className="text-xs text-slate-500">
                                  {recipient.sentAt ? formatDateTime(recipient.sentAt) : "Дата отправки ещё не зафиксирована"}
                                </p>
                                {recipient.lastError ? (
                                  <p className="text-xs text-rose-600">{recipient.lastError}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-sm text-slate-500">
                В реестре пока нет писем. Создай первое письмо или коммерческое предложение справа.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Новый документ</h2>
          </CardHeader>
          <CardContent>
            <CorrespondenceEditor companyId={activeCompanyId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
