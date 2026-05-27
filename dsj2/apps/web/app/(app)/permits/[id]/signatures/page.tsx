import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { signPermitAction } from "@/actions/permits";
import { PermitWorkflowNav } from "@/components/permit-summary";
import { SigningForm } from "@/components/signing-form";
import { StatusBadge } from "@/components/status-badge";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getPermitEntry } from "@/lib/permits";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitSignaturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const session = await requireRoleAccess(["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"]);
  const signingConfig = getSigningConfig();
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const companyId = firstString(rawSearchParams.companyId);
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const permit = await fetchPermit(id);
  const entry = getPermitEntry(permit);
  const envelopeId = permit.currentVersion?.documentEnvelopeId ?? null;
  const digest = entry?.documentVersionHash ?? null;

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Подписи и ЭЦП evidence</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{permit.permitCode}</h1>
          <p className="mt-2 text-sm text-slate-500">
            PDF не считается подписанным источником истины. Подписывается нормализованный
            payload и его hash.
          </p>
        </div>
        <PermitWorkflowNav permitId={permit.id} companyId={companyId ?? permit.organizationId} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Evidence state</h2>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <State label="Версия" value={permit.currentVersion?.status ?? "DRAFT"} />
            <State label="Конверт" value={envelopeId ? "active" : "missing_documents"} />
            <State label="Подпись" value={entry?.signatureStatus ?? "draft"} />
            <div className="rounded-lg border border-slate-200 p-4 md:col-span-3">
              <p className="text-sm font-medium text-slate-900">Хэши</p>
              <p className="mt-2 break-all text-sm text-slate-600">
                documentVersionHash: {entry?.documentVersionHash ?? "не создан"}
              </p>
              <p className="mt-1 break-all text-sm text-slate-600">
                signedPayloadHash: {entry?.signedPayloadHash ?? "не создан"}
              </p>
              <p className="mt-1 break-all text-sm text-slate-600">
                documentEnvelopeId: {envelopeId ?? "evidence не подготовлен"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Подписание</h2>
          </CardHeader>
          <CardContent>
            {!envelopeId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Evidence не подготовлен: у текущей версии нет documentEnvelopeId. UI не
                имитирует подпись и не считает PDF источником подписанной истины.
              </div>
            ) : signingConfig.isConfigured && digest ? (
              <SigningForm
                mode={signingConfig.provider}
                action={signPermitAction}
                hiddenFields={[
                  { name: "permitId", value: permit.id },
                  { name: "companyId", value: companyId ?? permit.organizationId },
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
                bridgeContext={{
                  documentNumber: entry?.permitNumber ?? permit.permitCode,
                }}
                title="Подписать допуск"
                description="ЭЦП evidence подтверждает факт подписания и версию payload."
                submitLabel="Подписать допуск"
                pendingLabel="Подписание..."
                mockHint="Mock-подпись используется только для тестового контура."
                bridgeHint="NCALayer подпишет hash нормализованного payload."
                testMode={signingConfig.testMode}
              />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {signingConfig.configError ?? "Digest для подписи не создан."}
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
