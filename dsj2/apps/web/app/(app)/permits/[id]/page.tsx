import Link from "next/link";
import { PageHeader } from "@dsj/ui";
import {
  activatePermitAction,
  annulPermitAction,
  archivePermitAction,
} from "@/actions/permits";
import { PermitSummary, PermitWorkflowNav } from "@/components/permit-summary";
import { SubmitButton } from "@/components/submit-button";
import { getDemoPersonaForEmail } from "@/lib/demo-personas";
import { requireRoleAccess } from "@/lib/auth";
import { fetchPermit } from "@/lib/permit-queries";
import { getEffectivePermitStatus, getPermitEntry } from "@/lib/permits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length ? value : null;
}

export default async function PermitDetailPage({
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
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const companyId = firstString(rawSearchParams.companyId);
  const errorMessage = firstString(rawSearchParams.error);
  const successMessage = firstString(rawSearchParams.success);
  const permit = await fetchPermit(id);
  const status = getEffectivePermitStatus(permit);
  const entry = getPermitEntry(permit);
  const precheckPassed = entry?.precheckSummary?.result === "PASS";
  const latestPdfSnapshot = permit.documentEnvelope?.exportSnapshots.find(
    (snapshot) => snapshot.format === "PDF_A_1",
  );
  const readOnly =
    getDemoPersonaForEmail(session.user.email)?.key === "director";

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
      {![
        "signed",
        "active",
        "suspended",
        "extended",
        "closed",
        "archived",
      ].includes(status) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          DRAFT / not legally signed. This preview is not a signed legal
          artifact.
        </div>
      ) : null}

      <PageHeader>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            Карточка допуска
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {permit.permitCode}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Подписанный payload отделён от PDF. Evidence показывается только при
            наличии document envelope.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <PermitWorkflowNav
            permitId={permit.id}
            companyId={companyId ?? permit.organizationId}
          />
          {!readOnly && status === "signed" ? (
            <form action={activatePermitAction} className="flex gap-2">
              <input type="hidden" name="permitId" value={permit.id} />
              <input
                type="hidden"
                name="companyId"
                value={companyId ?? permit.organizationId}
              />
              <SubmitButton label="Активировать" pendingLabel="Активация..." />
            </form>
          ) : null}
          <div className="flex gap-2">
            <Link
              href={`/api/permits/${permit.id}/pdf`}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              Download PDF
            </Link>
            <Link
              href={`/api/permits/${permit.id}/evidence`}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              Evidence manifest
            </Link>
          </div>
          <p className="max-w-xs break-all text-xs text-slate-500">
            PDF hash: {latestPdfSnapshot?.sha256 ?? "not generated"}
            {latestPdfSnapshot
              ? ` · ${new Date(latestPdfSnapshot.generatedAt).toLocaleString("ru-RU")}`
              : ""}
          </p>
          {!readOnly && ["closed", "expired", "cancelled"].includes(status) ? (
            <form action={archivePermitAction}>
              <input type="hidden" name="permitId" value={permit.id} />
              <input
                type="hidden"
                name="companyId"
                value={companyId ?? permit.organizationId}
              />
              <SubmitButton label="Архивировать" pendingLabel="Архивация..." />
            </form>
          ) : null}
          {!readOnly &&
          [
            "draft",
            "missing_documents",
            "pending_precheck",
            "rejected",
          ].includes(status) ? (
            <form action={annulPermitAction} className="flex gap-2">
              <input type="hidden" name="permitId" value={permit.id} />
              <input
                type="hidden"
                name="companyId"
                value={companyId ?? permit.organizationId}
              />
              <input
                type="hidden"
                name="reason"
                value="Допуск отменён из карточки допуска."
              />
              <SubmitButton
                label="Отменить допуск"
                pendingLabel="Отмена..."
                variant="danger"
              />
            </form>
          ) : null}
        </div>
      </PageHeader>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Demo lifecycle actions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Complete the enabled step, then return here for the next action.
            </p>
          </div>
          <p className="max-w-xl text-xs text-slate-500">
            MVP: specialized hot, gas, electrical, earth, confined-space, and
            lifting templates remain P1.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <LifecycleLink
            href={`/permits/${permit.id}/precheck?companyId=${companyId ?? permit.organizationId}`}
            label="Run precheck"
            enabled={["draft", "missing_documents"].includes(status)}
            reason="Available only while the permit is editable."
          />
          <LifecycleLink
            href={`/permits/${permit.id}/approvals?companyId=${companyId ?? permit.organizationId}`}
            label="Submit"
            enabled={
              ["draft", "missing_documents"].includes(status) && precheckPassed
            }
            reason={
              precheckPassed
                ? "Available only from draft."
                : "Run a PASS precheck first."
            }
          />
          <LifecycleLink
            href={`/permits/${permit.id}/approvals?companyId=${companyId ?? permit.organizationId}`}
            label="Approve"
            enabled={status === "pending_approval"}
            reason="Submit and confirm the work producer step first."
          />
          <LifecycleLink
            href={`/permits/${permit.id}/signatures?companyId=${companyId ?? permit.organizationId}`}
            label="Prepare sign"
            enabled={status === "approved"}
            reason="Available after approval."
          />
          <LifecycleLink
            href={`/permits/${permit.id}/signatures?companyId=${companyId ?? permit.organizationId}`}
            label="Sign"
            enabled={status === "signing_ready"}
            reason="Prepare the frozen signing version first."
          />
          <LifecycleLink
            href={`/permits/${permit.id}?companyId=${companyId ?? permit.organizationId}`}
            label="Activate"
            enabled={status === "signed"}
            reason="Requires a signature and a current PASS precheck."
          />
          <LifecycleLink
            href={`/permits/${permit.id}/closure?companyId=${companyId ?? permit.organizationId}`}
            label="Close"
            enabled={["active", "suspended"].includes(status)}
            reason="Available only for an active or suspended permit."
          />
          <LifecycleLink
            href={`/api/permits/${permit.id}/pdf`}
            label="Download PDF"
            enabled
            reason="Draft downloads are visibly marked as unsigned."
          />
          <LifecycleLink
            href={`/api/permits/${permit.id}/evidence`}
            label="Evidence"
            enabled
            reason="The manifest reflects the current lifecycle state."
          />
          <LifecycleLink
            href={`/permits/${permit.id}?companyId=${companyId ?? permit.organizationId}`}
            label="Archive"
            enabled={["closed", "expired", "cancelled"].includes(status)}
            reason="Archive is blocked until close, expiry, or cancellation."
          />
        </div>
      </div>

      <PermitSummary
        permit={permit}
        companyId={companyId ?? permit.organizationId}
        readOnly={readOnly}
      />
    </div>
  );
}

function LifecycleLink({
  href,
  label,
  enabled,
  reason,
}: {
  href: string;
  label: string;
  enabled: boolean;
  reason: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      {enabled ? (
        <Link
          href={href}
          className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="text-sm font-semibold text-slate-400"
        >
          {label}
        </span>
      )}
      <p className="mt-1 text-xs leading-5 text-slate-500">{reason}</p>
    </div>
  );
}
