import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import type { PublicBriefingInvite } from "@dsj/types";
import { formatDate, formatDateTime } from "@dsj/utils";
import { publicInviteSignAction } from "@/actions/public-invite";
import { SigningForm } from "@/components/signing-form";
import { apiFetch } from "@/lib/api";
import { briefingTypeLabels, statusLabels } from "@/lib/labels";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const signingConfig = getSigningConfig();
  const { token } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = typeof rawSearchParams.error === "string" ? rawSearchParams.error : null;
  const isSuccess = rawSearchParams.success === "1";

  let invite: PublicBriefingInvite | null = null;
  let fetchError: string | null = null;

  try {
    invite = await apiFetch<PublicBriefingInvite>(
      `signatures/public/briefing-invites/${token}`,
      undefined,
      {
        auth: false,
      },
    );
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Ссылка недоступна.";
  }

  if (!invite) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <Card className="w-full rounded-[28px]">
          <CardHeader>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
              Цифровой журнал по технике безопасности
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Ссылка недоступна</h1>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {fetchError ?? "Не удалось загрузить приглашение на подписание."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAlreadySigned = invite.status === "SIGNED";
  const signingConfigError = signingConfig.isConfigured ? null : signingConfig.configError;
  const isSigningAvailable = signingConfig.isConfigured && invite.signingAvailable;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="space-y-4">
          <PageHeader>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Персональная ссылка</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Подтверждение и подписание записи инструктажа
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Ссылка создана для конкретного участника инструктажа. Проверьте данные ниже и
                подтвердите подписание записи.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                Режим подписи: {signingConfig.provider}
              </p>
            </div>
          </PageHeader>

          <Card className="rounded-[28px]">
            <CardHeader className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {invite.documentNumber ?? "Запись инструктажа без номера"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{invite.topic}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {statusLabels[invite.status] ?? invite.status}
              </span>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Участник</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{invite.employee.fullName}</p>
                <p className="mt-1 text-sm text-slate-500">{invite.employee.jobTitle}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Инструктаж</p>
                <p className="mt-2 text-sm text-slate-900">
                  {briefingTypeLabels[invite.briefingType] ?? invite.briefingType}
                </p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(invite.briefingDate)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {invite.department?.name ?? "Подразделение не указано"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Инструктирующий: {invite.instructor.fullName}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Срок действия ссылки</p>
                <p className="mt-2 text-sm text-slate-700">
                  {invite.inviteTokenExpiresAt ? formatDateTime(invite.inviteTokenExpiresAt) : "Не ограничен"}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Хэш: {invite.signingDigest ?? "не задан"}
                </p>
                {invite.notes ? <p className="mt-3 text-sm text-slate-500">{invite.notes}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[28px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              {isAlreadySigned ? "Подписание завершено" : "Подписание записи"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {isSuccess || isAlreadySigned ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {invite.signedAt
                  ? `Подписание завершено ${formatDateTime(invite.signedAt)}.`
                  : "Подписание записи завершено."}
              </div>
            ) : !signingConfig.isConfigured ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {signingConfigError}
              </div>
            ) : !isSigningAvailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Подписание по персональной ссылке сейчас недоступно. Обратитесь к ответственному
                сотруднику вашей компании.
              </div>
            ) : (
              <SigningForm
                mode={signingConfig.provider}
                action={publicInviteSignAction}
                hiddenFields={[{ name: "token", value: token }]}
                fields={[
                  {
                    name: "signerName",
                    label: "ФИО подписанта",
                    defaultValue: invite.employee.fullName,
                    required: true,
                  },
                  {
                    name: "signerIin",
                    label: "ИИН подписанта",
                    placeholder: "980317350011",
                    required: true,
                  },
                  {
                    name: "certificateSerial",
                    label: "Серийный номер сертификата",
                    placeholder: "MOCKCERT-CONTRACTOR-0001",
                    required: true,
                  },
                ]}
                digest={invite.signingDigest}
                bridgeUrl={signingConfig.bridgeUrl ?? ""}
                bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                bridgeContext={{
                  inviteToken: token,
                  documentNumber: invite.documentNumber,
                }}
                title="Подписание приглашения"
                description="В mock-режиме подпись заполняется вручную. В режиме NCALayer используется локальный мост."
                submitLabel="Подписать запись"
                pendingLabel="Подписание..."
                mockHint="Укажите данные подписанта так, как они записаны в сертификате подписи."
                bridgeHint="Мост запросит сертификат и CMS/PKCS#7 у локального NCALayer."
                testMode={signingConfig.testMode}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
