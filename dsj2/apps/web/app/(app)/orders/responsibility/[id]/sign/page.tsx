import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { signResponsibilityOrderAction } from "@/actions/responsibility-order";
import { SigningForm } from "@/components/signing-form";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getResponsibilityTypeLabel } from "@/lib/labels";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

export default async function SignResponsibilityOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const signingConfig = getSigningConfig();
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const errorMessage = firstString(rawSearchParams.error);
  const companyId = firstString(rawSearchParams.companyId);
  const order = await apiFetch<{
    id: string;
    organizationId: string;
    number: string;
    date: string;
    responsibilityType: string;
    title: string;
    basis: string;
    status: string;
    signingDigest: string | null;
    signedAt: string | null;
    appointments: Array<{
      id: string;
      employee: {
        fullName: string;
        employeeNumber?: string | null;
        jobTitle?: string | null;
      };
      effectiveFrom: string;
      effectiveTo?: string | null;
    }>;
    allowedActions: {
      canSign: boolean;
    };
  }>(`responsibility-orders/${id}`);
  const effectiveCompanyId = companyId ?? order.organizationId;
  const signingConfigError = signingConfig.isConfigured ? null : signingConfig.configError;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Рабочее пространство подписи</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Подписать приказ</h1>
          <p className="mt-2 text-sm text-slate-500">
            Подпись создаётся через настроенного провайдера и прикрепляется к каноническому
            конверту приказа о назначении ответственных.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
            Провайдер подписи: {signingConfig.provider}
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">{order.number}</h2>
            <StatusBadge value={order.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {getResponsibilityTypeLabel(order.responsibilityType)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{order.title}</p>
              <p className="mt-1 text-sm text-slate-500">{order.basis}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDate(order.date)}</p>
              {order.signedAt ? (
                <p className="mt-1 text-sm text-slate-500">
                  Подписан {formatDateTime(order.signedAt)}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Назначения</p>
              <div className="mt-3 space-y-2">
                {order.appointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-md bg-white px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">
                      {appointment.employee.fullName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {appointment.employee.employeeNumber ?? "Без номера"}
                      {appointment.employee.jobTitle ? ` • ${appointment.employee.jobTitle}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(appointment.effectiveFrom)}
                      {appointment.effectiveTo ? ` → ${formatDate(appointment.effectiveTo)}` : " → без срока"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Подпись</h2>
          </CardHeader>
          <CardContent>
            {signingConfig.isConfigured ? (
              order.allowedActions.canSign && order.signingDigest ? (
                <SigningForm
                  mode={signingConfig.provider}
                  action={signResponsibilityOrderAction}
                  hiddenFields={[
                    { name: "orderId", value: order.id },
                    { name: "companyId", value: effectiveCompanyId },
                  ]}
                  fields={[
                    {
                      name: "signerName",
                      label: "ФИО подписанта",
                      defaultValue: session.user.fullName,
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
                      placeholder: "MOCKCERT-ALPINA-0002",
                      required: true,
                    },
                  ]}
                  digest={order.signingDigest}
                  bridgeUrl={signingConfig.bridgeUrl ?? ""}
                  bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                  bridgeContext={{
                    responsibilityOrderId: order.id,
                    documentNumber: order.number,
                  }}
                  title="Создать подпись приказа"
                  description="В mock-режиме подпись заполняется вручную. В режиме NCALayer используется локальный мост."
                  submitLabel="Подписать приказ"
                  pendingLabel="Подписание..."
                  mockHint="Используйте тестовые данные подписанта только в mock-режиме."
                  bridgeHint="Локальный мост NCALayer вернёт CMS/PKCS#7 для хэша приказа."
                  testMode={signingConfig.testMode}
                />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Сначала приказ нужно подготовить к подписанию.
                </div>
              )
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {signingConfigError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
