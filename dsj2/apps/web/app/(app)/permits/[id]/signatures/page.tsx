import Link from "next/link";
import { Card, CardContent, CardHeader, PageHeader, Textarea } from "@dsj/ui";
import { formatDateTime } from "@dsj/utils";
import { preparePermitSignAction, signPermitAction } from "@/actions/permits";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { SigningForm } from "@/components/signing-form";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus } from "@/lib/permits";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function PermitSignaturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess([
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "SAFETY_ENGINEER",
    "EMPLOYEE_SIGNER",
  ]);
  const signingConfig = getSigningConfig();
  const { id } = await params;
  const query = await searchParams;
  const companyId = firstString(query.companyId);
  const permit = await fetchPermit(id);
  const status = getEffectivePermitStatus(permit);
  const digest =
    permit.currentVersion?.signedPayloadHash ??
    permit.currentVersion?.payloadHash ??
    null;
  const envelope = permit.documentEnvelope;

  return (
    <div className="space-y-6">
      {firstString(query.error) ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {firstString(query.error)}
        </div>
      ) : null}
      {firstString(query.success) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {firstString(query.success)}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Подпись и evidence
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {permit.permitCode}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Подписывается hash канонического DocumentVersion со snapshots
            precheck.
          </p>
        </div>
        <PermitWorkflowNav
          permitId={permit.id}
          companyId={companyId ?? permit.organizationId}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">
              Evidence state
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <State
                label="Версия"
                value={permit.currentVersion?.status ?? "DRAFT"}
              />
              <State label="Конверт" value={envelope?.status ?? "missing"} />
              <State label="Lifecycle" value={status} />
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
              <p className="break-all">
                payloadHash: {permit.currentVersion?.payloadHash ?? "не создан"}
              </p>
              <p className="mt-1 break-all">
                signedPayloadHash:{" "}
                {permit.signedPayloadHash ?? "не зафиксирован"}
              </p>
              <p className="mt-1 break-all">
                documentEnvelopeId: {envelope?.id ?? "не создан"}
              </p>
            </div>
            {envelope?.signatures.length
              ? envelope.signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">
                          {signature.signerName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Сертификат: {signature.certificateSerial}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {signature.signedAt
                            ? formatDateTime(signature.signedAt)
                            : "время не зафиксировано"}
                        </p>
                      </div>
                      <StatusBadge
                        value={signature.verification?.result ?? "PENDING"}
                      />
                    </div>
                  </div>
                ))
              : null}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/api/permits/${permit.id}/pdf`}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                PDF
              </Link>
              <Link
                href={`/api/permits/${permit.id}/evidence`}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                Evidence JSON
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Подписание</h2>
          </CardHeader>
          <CardContent>
            {status === "approved" ? (
              <form action={preparePermitSignAction} className="space-y-3">
                <input type="hidden" name="permitId" value={permit.id} />
                <input
                  type="hidden"
                  name="companyId"
                  value={companyId ?? permit.organizationId}
                />
                <Textarea
                  name="comment"
                  placeholder="Комментарий выдающего наряд"
                />
                <SubmitButton
                  label="Зафиксировать версию"
                  pendingLabel="Фиксация..."
                />
              </form>
            ) : status === "signing_ready" &&
              signingConfig.isConfigured &&
              digest ? (
              <SigningForm
                mode={signingConfig.provider}
                action={signPermitAction}
                hiddenFields={[
                  { name: "permitId", value: permit.id },
                  {
                    name: "companyId",
                    value: companyId ?? permit.organizationId,
                  },
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
                    placeholder: "MOCKCERT-PERMIT-0001",
                    required: true,
                  },
                ]}
                digest={digest}
                bridgeUrl={signingConfig.bridgeUrl ?? ""}
                bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                bridgeContext={{ documentNumber: permit.permitCode }}
                title="Подписать допуск"
                description="Сессия проверит неизменность версии и hash."
                submitLabel="Подписать"
                pendingLabel="Подписание..."
                mockHint="Mock-провайдер доступен только в тестовом контуре."
                bridgeHint="NCALayer подписывает hash текущей FINAL-версии."
                testMode={signingConfig.testMode}
              />
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Текущий статус: {status}. Сначала завершите предыдущий шаг.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function State({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2">
        <StatusBadge value={value} />
      </div>
    </div>
  );
}
