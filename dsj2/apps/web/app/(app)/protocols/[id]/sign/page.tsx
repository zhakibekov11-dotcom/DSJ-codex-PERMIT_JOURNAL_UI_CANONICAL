import type { LegalSigningProvider } from "@dsj/types";
import { Card, CardContent, CardHeader, PageHeader } from "@dsj/ui";
import { formatDate, formatDateTime } from "@dsj/utils";
import { SigningSessionPanel } from "@/components/signing-session-panel";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { requireRoleAccess } from "@/lib/auth";
import { getSigningConfig } from "@/lib/signing-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length ? value : null;
}

function resolveSessionProvider(provider: string | null): LegalSigningProvider {
  return provider === "NCALAYER" || provider === "NCALAYER_PROVIDER"
    ? "NCALAYER_PROVIDER"
    : "MOCK_PROVIDER";
}

function resolveAvailableProviders(defaultProvider: LegalSigningProvider) {
  const providers: LegalSigningProvider[] = [defaultProvider];
  const mockEnabled =
    process.env.NODE_ENV !== "production" || process.env.SIGNING_MOCK_ENABLED === "true";

  if (mockEnabled && !providers.includes("MOCK_PROVIDER")) {
    providers.unshift("MOCK_PROVIDER");
  }

  if (process.env.EGOV_MOBILE_QR_ENABLED === "true") {
    providers.push("EGOV_MOBILE_QR_PROVIDER");
  }

  return providers;
}

export default async function SignProtocolPage({
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
  const protocol = await apiFetch<{
    id: string;
    organizationId: string;
    number: string;
    date: string;
    protocolType: string;
    basis: string;
    status: string;
    decision: string;
    signingDigest: string | null;
    signedAt: string | null;
    employees: Array<{
      employeeId: string;
      fullName: string;
      employeeNumber?: string | null;
      jobTitle?: string | null;
    }>;
    allowedActions: {
      canSign: boolean;
    };
  }>(`protocols/${id}`);
  const effectiveCompanyId = companyId ?? protocol.organizationId;
  const signingConfigError = signingConfig.isConfigured ? null : signingConfig.configError;
  const defaultSessionProvider = resolveSessionProvider(
    signingConfig.isConfigured ? signingConfig.provider : null,
  );
  const availableProviders = resolveAvailableProviders(defaultSessionProvider);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Signing workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Sign protocol
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This flow creates a generic signing session, then attaches the completed
            signature and evidence to the canonical protocol envelope.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
            Runtime provider: {signingConfig.provider}
          </p>
        </div>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-[24px]">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">{protocol.number}</h2>
            <StatusBadge value={protocol.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{protocol.protocolType}</p>
              <p className="mt-1 text-sm text-slate-500">{protocol.basis}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDate(protocol.date)}</p>
              {protocol.signedAt ? (
                <p className="mt-1 text-sm text-slate-500">
                  Signed {formatDateTime(protocol.signedAt)}
                </p>
              ) : null}
            </div>

            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Employees</p>
              <div className="mt-3 space-y-2">
                {protocol.employees.map((employee) => (
                  <div key={employee.employeeId} className="rounded-md bg-white px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{employee.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {employee.employeeNumber ?? "No number"}
                      {employee.jobTitle ? ` - ${employee.jobTitle}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Decision</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {protocol.decision}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Signature</h2>
          </CardHeader>
          <CardContent>
            {signingConfig.isConfigured ? (
              protocol.allowedActions.canSign && protocol.signingDigest ? (
                <SigningSessionPanel
                  documentType="PROTOCOL"
                  documentId={protocol.id}
                  documentHash={protocol.signingDigest}
                  documentNumber={protocol.number}
                  signerName={session.user.fullName}
                  defaultProvider={defaultSessionProvider}
                  availableProviders={availableProviders}
                  bridgeUrl={signingConfig.bridgeUrl ?? ""}
                  bridgeTimeoutMs={signingConfig.bridgeTimeoutMs}
                  testMode={signingConfig.testMode}
                />
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Prepare the protocol for signing first.
                </div>
              )
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {signingConfigError}
              </div>
            )}
            <input type="hidden" name="companyId" value={effectiveCompanyId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
