import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { canonicalPermitPayloadHash } from "./permit-hash";
import { WorkPermitsService } from "./work-permits.service";

const user = {
  userId: "demo-user",
  companyId: "demo-org",
  email: "permit.demo@example.test",
  fullName: "Permit Demo Safety Engineer",
  role: "SAFETY_ENGINEER" as const,
};

describe("work permit end-to-end demo lifecycle", () => {
  it("runs linked contractor act -> precheck -> sign -> close -> evidence -> archive", async () => {
    const actorEmployeeId = "demo-employee";
    const auditActions: string[] = [];
    const exportSnapshots: Array<Record<string, unknown>> = [];
    const archiveRecords: Array<Record<string, unknown>> = [];
    let status = "DRAFT";
    let envelopeStatus = "DRAFT";
    let versionStatus = "DRAFT";
    let signedPayloadHash: string | null = null;
    let startedAt: Date | null = null;
    let closedAt: Date | null = null;
    let archivedAt: Date | null = null;
    let closure: Record<string, unknown> | null = null;
    let archiveRecord: Record<string, unknown> | null = null;
    let signatures: Array<Record<string, unknown>> = [];
    let approvals: Array<Record<string, unknown>> = [];

    const baseEntry: Record<string, unknown> = {
      permitNumber: "PDM-WP-001",
      journalRegistrationNumber: "PDM-J-001",
      permitType: "CONTRACTOR_ACCESS",
      workType: "CONTRACTOR_SITE_ACCESS",
      status: "draft",
      workDescription: "General maintenance",
      workplace: "Maintenance bay A",
      startAt: "2026-06-07T08:00:00.000Z",
      endAt: "2026-06-07T12:00:00.000Z",
      contractorId: "contractor-1",
      contractorRepresentativeId: "contractor-worker-1",
      contractorAccessActId: "act-1",
      issuerId: actorEmployeeId,
      responsibleManagerId: actorEmployeeId,
      workProducerId: actorEmployeeId,
      admitterId: actorEmployeeId,
      observerId: actorEmployeeId,
      crew: [
        {
          employeeId: actorEmployeeId,
          contractorWorkerId: null,
          roleCode: "EXECUTOR",
        },
      ],
      crewMemberIds: [actorEmployeeId],
      hazardFactors: ["moving equipment"],
      safetyMeasures: "Lock out equipment and maintain the fenced perimeter.",
      workplacePreparationMeasures: "Stop, isolate, lock, and fence equipment.",
      targetBriefingText: "Review hazards, controls, and emergency actions.",
      targetBriefingAt: "2026-06-07T07:45:00.000Z",
      targetBriefingInstructorId: actorEmployeeId,
      crewInstructionAcknowledgements: [
        {
          employeeId: actorEmployeeId,
          contractorWorkerId: null,
          status: "acknowledged",
          acknowledgedAt: "2026-06-07T07:45:00.000Z",
        },
      ],
      ppeIssueRecordIds: [],
      legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
      trainingEvidenceIds: [],
      briefingEvidenceIds: [],
      certificateEvidenceIds: [],
      medicalEvidenceIds: [],
      requiredDocumentIds: [],
    };
    let entry = { ...baseEntry };

    const transaction = {
      workPermit: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.status === "string") status = data.status;
          if (typeof data.signedPayloadHash === "string") {
            signedPayloadHash = data.signedPayloadHash;
          }
          if (data.startedAt instanceof Date) startedAt = data.startedAt;
          if (data.closedAt instanceof Date) closedAt = data.closedAt;
          if (data.archivedAt instanceof Date) archivedAt = data.archivedAt;
        },
      },
      documentEnvelope: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.status === "string") envelopeStatus = data.status;
        },
      },
      documentVersion: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.status === "string") versionStatus = data.status;
        },
      },
      workPermitVersion: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.status === "string") versionStatus = data.status;
          if (typeof data.signedPayloadHash === "string") {
            signedPayloadHash = data.signedPayloadHash;
          }
        },
      },
      workPermitApproval: {
        deleteMany: async () => {
          approvals = [];
        },
        createMany: async ({
          data,
        }: {
          data: Array<Record<string, unknown>>;
        }) => {
          approvals = data.map((item, index) => ({
            id: `approval-${index + 1}`,
            status: "PENDING",
            metadataJson: {},
            ...item,
          }));
        },
        update: async ({
          where,
          data,
        }: {
          where: { permitId_stepNo: { stepNo: number } };
          data: Record<string, unknown>;
        }) => {
          const approval = approvals.find(
            (item) => item.stepNo === where.permitId_stepNo.stepNo,
          );
          if (approval) Object.assign(approval, data);
        },
        updateMany: async () => undefined,
      },
      workPermitClosure: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          closure = { id: "closure-1", ...data };
        },
      },
    };

    const prisma = {
      $transaction: async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
      employee: {
        findFirst: async ({ where }: { where: { userId: string } }) =>
          where.userId === user.userId
            ? { id: actorEmployeeId }
            : { id: "other" },
        findMany: async () => [
          {
            id: actorEmployeeId,
            fullName: user.fullName,
            employeeNumber: "PDM-001",
            jobTitle: "Safety engineer",
          },
        ],
      },
      contractorWorker: { findMany: async () => [] },
      contractorOrganization: {
        findFirst: async () => ({
          id: "contractor-1",
          name: "Demo Contractor",
        }),
        findMany: async () => [
          { id: "contractor-1", name: "Demo Contractor", bin: "000000000001" },
        ],
      },
      organization: {
        findUnique: async () => ({ id: "demo-org", name: "Demo Organization" }),
      },
      user: { findUnique: async () => null },
      workPermit: {
        findUnique: async () => permit(),
        findMany: async () => [],
        update: transaction.workPermit.update,
      },
      workPermitApproval: {
        update: transaction.workPermitApproval.update,
      },
      auditLog: { findMany: async () => [] },
      attachment: { findMany: async () => [] },
    };
    const corePlatform = {
      createSignature: async (
        _currentUser: unknown,
        input: Record<string, unknown>,
      ) => {
        const signature = { id: "signature-1", ...input };
        signatures = [signature];
        return signature;
      },
      createExportSnapshot: async (
        _currentUser: unknown,
        input: Record<string, unknown>,
      ) => {
        const snapshot = {
          id: `snapshot-${exportSnapshots.length + 1}`,
          ...input,
        };
        exportSnapshots.push(snapshot);
        return snapshot;
      },
      buildEvidencePackage: async () => ({
        document: {},
        signatures,
        exportSnapshots,
        archiveRecords,
        generatedAt: new Date(),
      }),
      ensureRetentionPolicyResolved: async () => ({
        source: "DEMO_TEST",
        policy: { id: "retention-1", retentionCode: "PDM-WORK-PERMIT-5Y" },
      }),
      createArchiveRecord: async (
        _currentUser: unknown,
        input: Record<string, unknown>,
      ) => {
        archiveRecord = { id: "archive-1", ...input };
        archiveRecords.push(archiveRecord);
        return archiveRecord;
      },
    };
    const service = new WorkPermitsService(
      prisma as never,
      {
        log: async ({ action }: { action: string }) => {
          auditActions.push(action);
        },
      } as never,
      corePlatform as never,
      {
        renderWorkPermit: async () => Buffer.from("%PDF-1.4 demo permit"),
      } as never,
      {
        sign: (input: Record<string, unknown>) => ({
          documentHash: input.documentHash,
          signerName: "Permit Demo Safety Engineer",
          signerIinMasked: "********0001",
          certificateSerial: "MOCK-PERMIT-DEMO",
          signedAt: new Date("2026-06-07T08:10:00.000Z"),
          payload: { mode: "demo-test" },
        }),
      } as never,
      {} as never,
    );

    const internal = service as unknown as {
      precheckPayloadHash: (value: Record<string, unknown>) => string;
      appendVersion: (
        transactionClient: unknown,
        currentPermit: unknown,
        payload: Record<string, unknown>,
      ) => Promise<{ id: string }>;
      renderAndSnapshotPermitPdf: () => Promise<{
        buffer: Buffer;
        sha256: string;
      }>;
      buildPermitEvidenceManifest: () => Promise<Record<string, unknown>>;
    };
    entry.precheckSummary = {
      result: "PASS",
      checkedAt: "2026-06-07T07:50:00.000Z",
      failedRules: [],
      blockerCount: 0,
      warningCount: 0,
      payloadHash: internal.precheckPayloadHash(entry),
    };
    internal.appendVersion = async (_transactionClient, _permit, payload) => {
      entry = {
        ...((payload.permitEntry ?? {}) as Record<string, unknown>),
      };
      return { id: "permit-version-1" };
    };
    internal.renderAndSnapshotPermitPdf = async () => {
      const buffer = Buffer.from("%PDF-1.4 demo permit");
      exportSnapshots.push({
        id: `snapshot-${exportSnapshots.length + 1}`,
        format: "PDF_A_1",
        sha256: "pdf-sha256",
        versionId: "document-version-1",
      });
      return { buffer, sha256: "pdf-sha256" };
    };
    internal.buildPermitEvidenceManifest = async () => ({
      permit: { id: "permit-1", status },
      hashes: {
        payloadHash: canonicalPermitPayloadHash({
          source: "PERMIT_JOURNAL_UI_CANONICAL",
          permitEntry: entry,
        }),
        signedPayloadHash,
        generatedPdfHash: "pdf-sha256",
      },
      precheck: { result: "PASS", payloadHash: entry.precheckSummary },
      signatures,
      auditEvents: auditActions,
      contractorAccessAct: { id: "act-1", status: "ACTIVE" },
      closure,
      manifestHash: "manifest-sha256",
    });

    function permit() {
      const payload = {
        source: "PERMIT_JOURNAL_UI_CANONICAL",
        permitEntry: entry,
      };
      const payloadHash = canonicalPermitPayloadHash(payload);
      return {
        id: "permit-1",
        organizationId: "demo-org",
        status,
        permitCode: "PDM-WP-001",
        journalRegistrationNumber: "PDM-J-001",
        permitType: "CONTRACTOR_ACCESS",
        workType: "CONTRACTOR_SITE_ACCESS",
        title: "General maintenance",
        workDescription: "General maintenance",
        workplace: "Maintenance bay A",
        scopeType: "WORK_SITE",
        branchId: "branch-1",
        departmentId: "department-1",
        workSiteId: "site-1",
        contractorOrganizationId: "contractor-1",
        contractorRepresentativeId: "contractor-worker-1",
        contractorAccessActId: "act-1",
        issuerEmployeeId: actorEmployeeId,
        responsibleManagerEmployeeId: actorEmployeeId,
        workProducerEmployeeId: actorEmployeeId,
        admitterEmployeeId: actorEmployeeId,
        observerEmployeeId: actorEmployeeId,
        documentEnvelopeId: "envelope-1",
        currentVersionId: "permit-version-1",
        issuedAt: null,
        startedAt,
        closedAt,
        approvedAt: null,
        signedAt: status === "SIGNED" ? new Date() : null,
        archivedAt,
        effectiveFrom: new Date("2026-06-07T08:00:00.000Z"),
        effectiveTo: new Date("2026-06-07T12:00:00.000Z"),
        signedPayloadHash,
        rejectionReason: null,
        suspensionReason: null,
        cancellationReason: null,
        archiveRecordId: archiveRecord ? "archive-1" : null,
        retentionPolicyId: archiveRecord ? "retention-1" : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentVersion: {
          id: "permit-version-1",
          versionNo: 1,
          status: versionStatus,
          payloadJson: payload,
          payloadHash,
          signedPayloadHash,
          documentEnvelopeId: "envelope-1",
          documentVersionId: "document-version-1",
          documentVersion: {
            id: "document-version-1",
            status: versionStatus,
            renderedHash: signedPayloadHash ?? payloadHash,
          },
        },
        versions: [],
        brigades: [
          {
            id: "brigade-1",
            members: [
              {
                employeeId: actorEmployeeId,
                contractorWorkerId: null,
              },
            ],
          },
        ],
        approvals,
        precheckRuns: [
          {
            id: "precheck-1",
            result: "PASS",
            checkedAt: new Date("2026-06-07T07:50:00.000Z"),
            snapshotHash: "precheck-snapshot-hash",
            versionId: "permit-version-1",
            checksJson: [],
          },
        ],
        closure,
        branch: { id: "branch-1", code: "PDM", name: "Demo Branch" },
        workSite: { id: "site-1", name: "Demo Workshop", location: "Bay A" },
        contractorAccessAct: {
          id: "act-1",
          actNumber: "PDM-ACT-001",
          status: "ACTIVE",
          validFrom: new Date("2026-06-06T00:00:00.000Z"),
          validTo: new Date("2026-07-07T00:00:00.000Z"),
          workArea: "Maintenance bay A",
          contractorOrganizationId: "contractor-1",
          contractorRepresentativeId: "contractor-worker-1",
          contractorOrganization: {
            id: "contractor-1",
            name: "Demo Contractor",
          },
          contractorRepresentative: null,
        },
        documentEnvelope: {
          id: "envelope-1",
          status: envelopeStatus,
          approvalRouteId: null,
          currentVersion: {
            id: "document-version-1",
            status: versionStatus,
            renderedHash: signedPayloadHash ?? payloadHash,
          },
          approvalRoute: { steps: [] },
          signatures,
          archiveRecords,
          exportSnapshots,
        },
        archiveRecord,
      };
    }

    assert.equal(permit().contractorAccessAct.status, "ACTIVE");

    await service.submit(user, "permit-1", { comment: "Demo submit" });
    assert.equal(status, "IN_APPROVAL");
    assert.equal(approvals.length, 4);

    await service.confirm(user, "permit-1", { comment: "Demo confirm" });
    assert.equal(approvals[0]?.status, "CONFIRMED");

    await service.approve(user, "permit-1", { comment: "Demo approve" });
    assert.equal(status, "APPROVED");

    await service.prepareSign(user, "permit-1", { comment: "Freeze payload" });
    assert.equal(status, "SIGNING_READY");
    const frozenHash = signedPayloadHash;
    assert.equal(frozenHash, permit().currentVersion.payloadHash);

    await service.completeSigning(
      user,
      {
        id: "session-1",
        organizationId: "demo-org",
        documentId: "permit-1",
        documentEnvelopeId: "envelope-1",
        documentVersionId: "document-version-1",
        documentHash: frozenHash!,
        correlationId: "correlation-1",
      },
      "MOCK_PROVIDER",
      {
        signerName: "Permit Demo Safety Engineer",
        signerIin: "DEMO-IIN-0001",
        certificateSerial: "MOCK-PERMIT-DEMO",
      },
    );
    assert.equal(status, "SIGNED");
    assert.equal(signedPayloadHash, frozenHash);

    await assert.rejects(
      () => service.archive(user, "permit-1"),
      (error) => error instanceof ConflictException,
    );

    await service.activate(user, "permit-1", { comment: "Demo activate" });
    assert.equal(status, "ACTIVE");
    assert.ok(startedAt);

    await assert.rejects(
      () =>
        service.update(user, "permit-1", {
          workDescription: "Forbidden signed payload mutation",
        }),
      (error) => error instanceof ConflictException,
    );

    await service.close(user, "permit-1", {
      comment: "Demo close",
      closure: {
        result: "Work completed",
        inspection: "Workplace inspected and released",
        closedAt: "2026-06-07T12:00:00.000Z",
      },
    });
    assert.equal(status, "CLOSED");
    assert.ok(closure);

    const pdf = await service.download(user, "permit-1");
    assert.ok(pdf.length > 0);

    const evidence = await service.evidence(user, "permit-1");
    assert.deepEqual(evidence.contractorAccessAct, {
      id: "act-1",
      status: "ACTIVE",
    });
    assert.equal(evidence.hashes.signedPayloadHash, frozenHash);

    await service.archive(user, "permit-1");
    assert.equal(status, "ARCHIVED");
    assert.ok(archivedAt);
    assert.equal(archiveRecords.length, 1);
    assert.equal(archiveRecords[0]?.archiveManifestHash, "manifest-sha256");
  });

  it("denies same-organization PDF and evidence to an unrelated employee signer", async () => {
    const permit = {
      id: "permit-1",
      organizationId: "demo-org",
      status: "CLOSED",
      brigades: [],
      issuerEmployeeId: "assigned-employee",
      responsibleManagerEmployeeId: null,
      workProducerEmployeeId: null,
      admitterEmployeeId: null,
    };
    const service = new WorkPermitsService(
      {
        workPermit: { findUnique: async () => permit },
        employee: { findFirst: async () => ({ id: "unrelated-employee" }) },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const signer = {
      ...user,
      userId: "unrelated-user",
      role: "EMPLOYEE_SIGNER" as const,
    };

    await assert.rejects(
      () => service.download(signer, "permit-1"),
      (error) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => service.evidence(signer, "permit-1"),
      (error) => error instanceof ForbiddenException,
    );
  });
});
