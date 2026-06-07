import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { WorkPermitsService } from "./work-permits.service";

const user = {
  userId: "user-1",
  companyId: "org-1",
  email: "admin@example.com",
  fullName: "Admin",
  role: "COMPANY_ADMIN" as const,
};

function createService(prisma: Record<string, unknown>) {
  return new WorkPermitsService(
    prisma as never,
    { log: async () => undefined } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function createArtifactService(args: {
  permit: Record<string, unknown>;
  genericEvidence?: Record<string, unknown>;
}) {
  const rendered: Array<Record<string, unknown>> = [];
  const snapshots: Array<Record<string, unknown>> = [];
  const archiveRecords: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const prisma = {
    $transaction: async (
      callback: (transaction: Record<string, unknown>) => Promise<unknown>,
    ) =>
      callback({
        documentEnvelope: { update: async () => undefined },
        workPermit: { update: async () => undefined },
      }),
    workPermit: {
      findUnique: async () => args.permit,
      findMany: async () => [],
      update: async () => undefined,
    },
    documentEnvelope: {
      update: async () => undefined,
    },
    employee: {
      findFirst: async () => ({ id: "employee-1" }),
      findMany: async () => [
        {
          id: "employee-1",
          fullName: "Frozen Employee",
          employeeNumber: "E-1",
          jobTitle: "Worker",
        },
      ],
    },
    contractorWorker: {
      findMany: async () => [],
    },
    contractorOrganization: {
      findFirst: async () => null,
    },
    organization: {
      findUnique: async () => ({ id: "org-1", name: "DSJ Test LLP" }),
    },
    user: {
      findUnique: async () => null,
    },
    auditLog: {
      findMany: async () => auditEvents,
    },
    attachment: {
      findMany: async () => [],
    },
  };
  const corePlatformService = {
    createExportSnapshot: async (
      _user: unknown,
      input: Record<string, unknown>,
    ) => {
      snapshots.push(input);
      return { id: `snapshot-${snapshots.length}`, ...input };
    },
    buildEvidencePackage: async () =>
      args.genericEvidence ?? {
        document: {},
        signatures: [],
        exportSnapshots: [],
        archiveRecords: [],
        generatedAt: new Date(),
      },
    ensureRetentionPolicyResolved: async () => ({
      source: "TEST",
      policy: {
        id: "retention-1",
        retentionCode: "WORK_PERMIT_TEST",
      },
    }),
    createArchiveRecord: async (
      _user: unknown,
      input: Record<string, unknown>,
    ) => {
      archiveRecords.push(input);
      return { id: "archive-1", ...input };
    },
  };
  const service = new WorkPermitsService(
    prisma as never,
    {
      log: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
    corePlatformService as never,
    {
      renderWorkPermit: async (record: Record<string, unknown>) => {
        rendered.push(record);
        return Buffer.from(
          JSON.stringify({
            draft: record.draft,
            workDescription: record.workDescription,
            payloadHash: record.payloadHash,
          }),
        );
      },
    } as never,
    {} as never,
    {} as never,
  );
  return { service, rendered, snapshots, archiveRecords, auditEvents };
}

function permitFixture(entry: Record<string, unknown>) {
  return {
    id: "permit-1",
    organizationId: "org-1",
    status: "DRAFT",
    permitCode: String(entry.permitNumber ?? "WP-1"),
    journalRegistrationNumber: String(
      entry.journalRegistrationNumber ?? "PJ-1",
    ),
    permitType: "HIGH_RISK_WORK",
    workType: "GENERAL_HIGH_RISK",
    workDescription: String(entry.workDescription ?? "Maintenance"),
    workplace: String(entry.workplace ?? "Workshop"),
    scopeType: "ORGANIZATION",
    branchId: null,
    workSiteId: null,
    departmentId: null,
    contractorOrganizationId: null,
    contractorRepresentativeId: null,
    contractorAccessActId: null,
    issuerEmployeeId: null,
    responsibleManagerEmployeeId: null,
    workProducerEmployeeId: null,
    admitterEmployeeId: null,
    observerEmployeeId: null,
    issuedAt: null,
    startedAt: null,
    closedAt: null,
    approvedAt: null,
    signedAt: null,
    archivedAt: null,
    effectiveFrom: new Date("2026-06-06T08:00:00.000Z"),
    effectiveTo: new Date("2026-06-06T12:00:00.000Z"),
    documentEnvelopeId: null,
    rejectionReason: null,
    suspensionReason: null,
    cancellationReason: null,
    signedPayloadHash: null,
    archiveRecordId: null,
    retentionPolicyId: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    currentVersion: {
      id: "version-1",
      payloadHash: "payload-hash-1",
      documentVersionId: "document-version-1",
      documentVersion: {
        id: "document-version-1",
        renderedHash: "document-version-hash-1",
      },
      payloadJson: {
        permitEntry: entry,
      },
    },
    precheckRuns: [],
    approvals: [],
    brigades: [
      {
        id: "brigade-1",
        members: [
          {
            employeeId: "employee-1",
            contractorWorkerId: null,
          },
        ],
      },
    ],
    archiveRecord: null,
    documentEnvelope: null,
    contractorAccessAct: null,
    branch: null,
    workSite: null,
    closure: null,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    permitNumber: "WP-1",
    journalRegistrationNumber: "PJ-1",
    permitType: "HIGH_RISK_WORK",
    workType: "GENERAL_HIGH_RISK",
    workDescription: "Maintenance",
    workplace: "Workshop",
    scopeType: "ORGANIZATION",
    branchId: null,
    departmentId: null,
    workSiteId: null,
    startAt: "2026-06-06T08:00:00.000Z",
    endAt: "2026-06-06T12:00:00.000Z",
    contractorId: null,
    contractorRepresentativeId: null,
    contractorAccessActId: null,
    issuerId: null,
    responsibleManagerId: null,
    workProducerId: null,
    admitterId: null,
    observerId: null,
    crew: { employeeIds: [], contractorWorkerIds: [] },
    hazardFactors: ["moving equipment"],
    safetyMeasures: "Lock out equipment.",
    ppeIssueRecordIds: [],
    legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
    trainingEvidenceIds: [],
    briefingEvidenceIds: [],
    certificateEvidenceIds: [],
    medicalEvidenceIds: [],
    requiredDocumentIds: [],
    ...overrides,
  };
}

function listPrisma(rows: Array<Record<string, unknown>>, actorId?: string) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    prisma: {
      workPermit: {
        findMany: async (args: Record<string, unknown>) => {
          calls.push(args);
          return args.select ? [] : rows;
        },
        count: async (args: Record<string, unknown>) => {
          calls.push({ count: args });
          return rows.length;
        },
      },
      employee: {
        findFirst: async () => (actorId ? { id: actorId } : null),
        findMany: async () => [
          {
            id: "issuer-1",
            fullName: "Permit Issuer",
            employeeNumber: "E-1",
            jobTitle: "Safety engineer",
          },
        ],
      },
      contractorOrganization: {
        findMany: async () => [
          {
            id: "contractor-1",
            name: "Contractor LLP",
            bin: "123456789012",
          },
        ],
      },
    },
  };
}

function precheckPrisma(args: {
  employeeStatus?: string;
  employeeArchived?: boolean;
  medicalExpiry?: Date;
  ppeExpiry?: Date;
  contractorWorkerContractorId?: string;
  contractorWorkerStatus?: string;
  contractorWorkerArchived?: boolean;
  contractorAccessActStatus?: string;
  contractorAccessActContractorId?: string;
  contractorAccessActValidTo?: Date;
}) {
  let precheckData: Record<string, unknown> | null = null;
  const employeeDocumentRows = [
    {
      id: "certificate-1",
      employeeId: "employee-1",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      issueDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: new Date("2027-01-01T00:00:00.000Z"),
      documentNumber: "CERT-1",
    },
    {
      id: "medical-1",
      employeeId: "employee-1",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      issueDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: args.medicalExpiry ?? new Date("2027-01-01T00:00:00.000Z"),
      documentNumber: "MED-1",
    },
  ];
  const contractorWorkerRows = args.contractorWorkerContractorId
    ? [
        {
          id: "worker-1",
          status: args.contractorWorkerStatus ?? "active",
          isArchived: args.contractorWorkerArchived ?? false,
          contractorOrganizationId: args.contractorWorkerContractorId,
        },
      ]
    : [];
  const ppeIssueRows = [
    {
      id: "ppe-1",
      employeeId: "employee-1",
      contractorWorkerId: null,
      itemCode: "HELMET",
      status: "ACTIVE",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: args.ppeExpiry ?? new Date("2027-01-01T00:00:00.000Z"),
    },
    ...contractorWorkerRows.map((worker) => ({
      id: "ppe-worker-1",
      employeeId: null,
      contractorWorkerId: worker.id,
      itemCode: "HARNESS",
      status: "ACTIVE",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
    })),
  ];
  const prisma = {
    employee: {
      findMany: async () => [
        {
          id: "employee-1",
          status: args.employeeStatus ?? "active",
          isArchived: args.employeeArchived ?? false,
        },
      ],
    },
    contractorWorker: { findMany: async () => contractorWorkerRows },
    trainingAssignment: {
      findMany: async () => [
        {
          id: "training-1",
          employeeId: "employee-1",
          status: "COMPLETED",
          trainingProgram: { requiresExam: false },
          examAttempts: [],
        },
      ],
    },
    briefingJournalEntry: {
      findMany: async () => [
        {
          id: "briefing-1",
          employeeId: "employee-1",
          status: "SIGNED",
        },
      ],
    },
    employeeDocument: { findMany: async () => employeeDocumentRows },
    safetyCertificate: { findMany: async () => [] },
    qualificationDocument: {
      findMany: async () => [
        {
          id: "medical-1",
          employeeId: "employee-1",
          contractorWorkerId: null,
          documentKind: "MEDICAL_CLEARANCE",
          documentNumber: "MED-1",
          status: "ACTIVE",
          issueDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate:
            args.medicalExpiry ?? new Date("2027-01-01T00:00:00.000Z"),
        },
      ],
    },
    documentEnvelope: {
      findMany: async () => [
        {
          id: "required-1",
          status: "SIGNED",
        },
      ],
    },
    ppeIssueRecord: {
      findMany: async () => [...ppeIssueRows],
    },
    workSite: { findFirst: async () => null },
    contractorOrganization: {
      findFirst: async () =>
        args.contractorWorkerContractorId ? { id: "contractor-1" } : null,
    },
    contractorAccessAct: {
      findFirst: async () =>
        args.contractorAccessActStatus
          ? {
              id: "act-1",
              actNumber: "CAA-1",
              status: args.contractorAccessActStatus,
              validFrom: new Date("2026-06-06T07:00:00.000Z"),
              validTo:
                args.contractorAccessActValidTo ??
                new Date("2026-06-06T13:00:00.000Z"),
              workArea: "Workshop A",
              contractorOrganizationId:
                args.contractorAccessActContractorId ?? "contractor-1",
              contractorRepresentativeId: "worker-1",
            }
          : null,
    },
    $transaction: async (
      callback: (transaction: Record<string, unknown>) => Promise<unknown>,
    ) =>
      callback({
        workPermitPrecheckRun: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            precheckData = data;
            return data;
          },
        },
        workPermit: { update: async () => undefined },
      }),
  };
  return {
    prisma,
    getPrecheckData: () => precheckData,
  };
}

const evidenceEntry = {
  permitNumber: "WP-1",
  journalRegistrationNumber: "PJ-1",
  permitType: "HIGH_RISK_WORK",
  workType: "GENERAL_HIGH_RISK",
  status: "draft",
  workDescription: "Maintenance",
  workplace: "Workshop",
  startAt: "2026-06-06T08:00:00.000Z",
  endAt: "2026-06-06T12:00:00.000Z",
  hazardFactors: ["moving equipment"],
  safetyMeasures: "Lock out equipment.",
  workplacePreparationMeasures: "Isolate and fence the workplace.",
  targetBriefingText: "Review hazards and safe work method.",
  targetBriefingAt: "2026-06-06T07:45:00.000Z",
  targetBriefingInstructorId: "employee-1",
  crewInstructionAcknowledgements: [
    {
      employeeId: "employee-1",
      contractorWorkerId: null,
      status: "acknowledged",
      acknowledgedAt: "2026-06-06T07:45:00.000Z",
    },
  ],
  legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
  legalBasisVersion: "KZ_ORDER_344_APPENDIX_1",
  legalBasisEffectiveDate: "2020-08-28",
  trainingEvidenceIds: ["training-1"],
  briefingEvidenceIds: ["briefing-1"],
  certificateEvidenceIds: ["certificate-1"],
  medicalEvidenceIds: ["medical-1"],
  requiredDocumentIds: ["required-1"],
  ppeIssueRecordIds: ["ppe-1"],
};

async function runPrecheckFixture(
  args: Parameters<typeof precheckPrisma>[0] = {},
  permitOverrides: Record<string, unknown> = {},
) {
  const fixture = precheckPrisma(args);
  const service = createService(fixture.prisma);
  const internal = service as unknown as {
    findPermit: () => Promise<Record<string, unknown>>;
    assertAccess: () => Promise<null>;
    appendVersion: () => Promise<{ id: string }>;
    get: () => Promise<{ id: string }>;
  };
  internal.findPermit = async () => ({
    ...permitFixture(evidenceEntry),
    ...permitOverrides,
  });
  internal.assertAccess = async () => null;
  internal.appendVersion = async () => ({ id: "version-2" });
  internal.get = async () => ({ id: "permit-1" });
  await service.precheck(user, "permit-1");
  return fixture.getPrecheckData();
}

describe("work permit service guards", () => {
  it("builds a KZ Order 344 Appendix 1 payload for general high-risk permits", () => {
    const service = createService({});
    const internal = service as unknown as {
      entryFromInput: (
        input: Record<string, unknown>,
        status?: string,
      ) => Record<string, unknown>;
    };

    const entry = internal.entryFromInput({
      organizationId: "org-1",
      permitNumber: "WP-1",
      journalRegistrationNumber: "PJ-1",
      permitType: "HIGH_RISK_WORK",
      workType: "GENERAL_HIGH_RISK",
      workDescription: "Maintenance",
      workplace: "Workshop",
      equipmentOrObject: "Conveyor line 2",
      scopeType: "ORGANIZATION",
      branchId: null,
      departmentId: null,
      workSiteId: null,
      startAt: "2026-06-06T08:00:00.000Z",
      endAt: "2026-06-06T12:00:00.000Z",
      contractorId: null,
      contractorRepresentativeId: null,
      issuerId: "employee-1",
      responsibleManagerId: "employee-1",
      workProducerId: "employee-1",
      admitterId: "employee-1",
      observerId: null,
      crew: { employeeIds: ["employee-1"], contractorWorkerIds: [] },
      hazardFactors: ["moving equipment"],
      safetyMeasures: "Lock out equipment.",
      workplacePreparationMeasures: "Stop and isolate equipment.",
      safetyMeasureExecutors: "Issuer and work producer.",
      airAnalysisRequired: true,
      airAnalysisResult: "Within permitted range.",
      airAnalysisAt: "2026-06-06T07:30:00.000Z",
      airAnalysisBy: "Lab technician",
      isolationLockoutMeasures: "LOTO tag WP-1.",
      fencingAndSignsMeasures: "Warning tape and signs installed.",
      fireSafetyMeasures: "Fire extinguisher nearby.",
      communicationOrAdjacentAreaApprovals: "Adjacent shop notified.",
      targetBriefingText: "Review hazards and safe method.",
      targetBriefingAt: "2026-06-06T07:45:00.000Z",
      targetBriefingInstructorId: "employee-1",
      admissionAt: "2026-06-06T08:00:00.000Z",
      admittedById: "employee-1",
      acceptedByWorkProducerAt: "2026-06-06T08:05:00.000Z",
      ppeRequirements: "Helmet and glasses.",
      ppeIssueRecordIds: ["ppe-1"],
      legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
      trainingEvidenceIds: ["training-1"],
      briefingEvidenceIds: ["briefing-1"],
      certificateEvidenceIds: ["certificate-1"],
      medicalEvidenceIds: ["medical-1"],
      requiredDocumentIds: ["required-1"],
    });

    assert.equal(entry.equipmentOrObject, "Conveyor line 2");
    assert.equal(
      entry.workplacePreparationMeasures,
      "Stop and isolate equipment.",
    );
    assert.equal(entry.airAnalysisRequired, true);
    assert.equal(entry.targetBriefingInstructorId, "employee-1");
    assert.equal(entry.admittedById, "employee-1");
    assert.equal(entry.legalBasisVersion, "KZ_ORDER_344_APPENDIX_1");
    assert.equal(entry.legalBasisEffectiveDate, "2020-08-28");
    assert.deepEqual(entry.crewInstructionAcknowledgements, [
      {
        employeeId: "employee-1",
        contractorWorkerId: null,
        status: "pending",
        acknowledgedAt: null,
      },
    ]);
  });

  it("updates Appendix 1 draft fields through the canonical version path", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const service = createService({
      $transaction: async (
        callback: (transaction: Record<string, unknown>) => Promise<unknown>,
      ) =>
        callback({
          workPermit: { update: async () => undefined },
          workPermitApproval: { deleteMany: async () => undefined },
          brigade: {
            create: async () => ({ id: "brigade-1" }),
            update: async () => undefined,
          },
          brigadeMember: {
            deleteMany: async () => undefined,
            createMany: async () => undefined,
          },
        }),
    });
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      validateReferences: () => Promise<void>;
      appendVersion: (
        transaction: Record<string, unknown>,
        permit: Record<string, unknown>,
        payload: Record<string, unknown>,
        userId: string,
      ) => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => permitFixture(evidenceEntry);
    internal.assertAccess = async () => null;
    internal.validateReferences = async () => undefined;
    internal.appendVersion = async (_transaction, _permit, payload) => {
      capturedPayload = payload;
      return { id: "version-2" };
    };
    internal.get = async () => ({ id: "permit-1" });

    await service.update(user, "permit-1", {
      equipmentOrObject: "Updated tank",
      workplacePreparationMeasures: "Drain and isolate tank.",
      airAnalysisRequired: true,
      airAnalysisResult: "Pass",
      targetBriefingText: "Updated briefing.",
      admissionAt: "2026-06-06T08:10:00.000Z",
    });

    assert.ok(capturedPayload);
    const payload = capturedPayload as Record<string, unknown>;
    const entry = (payload["permitEntry"] ?? {}) as Record<string, unknown>;
    assert.equal(entry.equipmentOrObject, "Updated tank");
    assert.equal(entry.workplacePreparationMeasures, "Drain and isolate tank.");
    assert.equal(entry.airAnalysisRequired, true);
    assert.equal(entry.airAnalysisResult, "Pass");
    assert.equal(entry.targetBriefingText, "Updated briefing.");
    assert.equal(entry.admissionAt, "2026-06-06T08:10:00.000Z");
    assert.equal(entry.legalBasisVersion, "KZ_ORDER_344_APPENDIX_1");
  });

  for (const status of [
    "APPROVED",
    "SIGNING_READY",
    "SIGNED",
    "ACTIVE",
    "CLOSED",
  ]) {
    it(`rejects direct field updates after ${status}`, async () => {
      const service = createService({});
      const internal = service as unknown as {
        findPermit: () => Promise<Record<string, unknown>>;
        assertAccess: () => Promise<null>;
      };
      internal.findPermit = async () => ({
        ...permitFixture(evidenceEntry),
        status,
      });
      internal.assertAccess = async () => null;

      await assert.rejects(
        () =>
          service.update(user, "permit-1", {
            journalRegistrationNumber: "PJ-TAMPERED",
          }),
        (error) => error instanceof ConflictException,
      );
    });
  }

  it("maps duplicate journal registration numbers to a conflict", async () => {
    const service = createService({
      $transaction: async () => {
        throw {
          code: "P2002",
          meta: {
            target: ["organizationId", "journalRegistrationNumber"],
          },
        };
      },
    });
    const internal = service as unknown as {
      validateReferences: () => Promise<void>;
      approvalRoute: () => Promise<null>;
    };
    internal.validateReferences = async () => undefined;
    internal.approvalRoute = async () => null;

    await assert.rejects(
      () => service.create(user, createInput() as never),
      (error) =>
        error instanceof ConflictException &&
        error.message.includes("Journal registration number"),
    );
  });

  it("returns Appendix 2 journal fields from the list endpoint", async () => {
    const fixture = listPrisma(
      [
        {
          ...permitFixture(evidenceEntry),
          issuerEmployeeId: "issuer-1",
          contractorOrganizationId: "contractor-1",
          startedAt: new Date("2026-06-06T08:15:00.000Z"),
        },
      ],
      "issuer-1",
    );
    const service = createService(fixture.prisma);

    const page = await service.list(user, {
      organizationId: "org-1",
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 25,
    });
    const item = page.items[0] as Record<string, unknown>;
    const journal = item.journal as Record<string, unknown>;

    assert.equal(item.journalRegistrationNumber, "PJ-1");
    assert.equal(item.permitCode, "WP-1");
    assert.equal(journal.journalRegistrationNumber, "PJ-1");
    assert.equal(journal.permitNumber, "WP-1");
    assert.equal(journal.initialAdmissionAt, "2026-06-06T08:15:00.000Z");
    assert.equal(journal.repeatedAdmissionAt, null);
    assert.equal(
      (journal.issuer as Record<string, unknown>).displayName,
      "Permit Issuer",
    );
    assert.equal(
      (journal.contractor as Record<string, unknown>).displayName,
      "Contractor LLP",
    );
  });

  it("keeps journal list tenant scoped and preserves active/archive filters", async () => {
    const fixture = listPrisma([permitFixture(evidenceEntry)]);
    const service = createService(fixture.prisma);

    await service.list(user, {
      organizationId: "org-1",
      activeOnly: true,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 25,
    });
    await service.list(user, {
      organizationId: "org-1",
      archivedOnly: true,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 25,
    });

    const listCalls = fixture.calls.filter((call) => "where" in call);
    assert.equal(
      (listCalls[1].where as Record<string, unknown>).organizationId,
      "org-1",
    );
    assert.equal(
      (listCalls[1].where as Record<string, unknown>).status,
      "ACTIVE",
    );
    assert.equal(
      (listCalls[3].where as Record<string, unknown>).organizationId,
      "org-1",
    );
    assert.equal(
      (listCalls[3].where as Record<string, unknown>).status,
      "ARCHIVED",
    );
  });

  it("scopes employee signers to their assigned permits in the journal list", async () => {
    const fixture = listPrisma([], "employee-1");
    const service = createService(fixture.prisma);

    await service.list(
      {
        ...user,
        role: "EMPLOYEE_SIGNER",
        userId: "signer-user",
      },
      {
        organizationId: "org-1",
        sortBy: "createdAt",
        sortOrder: "desc",
        page: 1,
        pageSize: 25,
      },
    );

    const listCall = fixture.calls.find(
      (call) => "where" in call && !(call as { select?: unknown }).select,
    );
    const where = listCall?.where as Record<string, unknown>;
    assert.equal(where.organizationId, "org-1");
    assert.ok(Array.isArray(where.OR));
  });

  it("sets startedAt when a permit is activated for journal admission display", async () => {
    let updateData: Record<string, unknown> | null = null;
    const service = createService({
      workPermit: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
        },
      },
    });
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      transition: () => Promise<void>;
      get: () => Promise<Record<string, unknown>>;
      precheckPayloadHash: (entry: Record<string, unknown>) => string;
    };
    const payloadHash = internal.precheckPayloadHash(evidenceEntry);
    internal.findPermit = async () => ({
      ...permitFixture({
        ...evidenceEntry,
        precheckSummary: {
          result: "PASS",
          checkedAt: "2026-06-06T07:50:00.000Z",
          failedRules: [],
          payloadHash,
        },
      }),
      status: "SIGNED",
      precheckRuns: [{ result: "PASS" }],
    });
    internal.transition = async () => undefined;
    internal.get = async () => permitFixture(evidenceEntry);

    await service.activate(user, "permit-1", {});

    const data = updateData as Record<string, unknown> | null;
    assert.ok(data);
    assert.ok(data["startedAt"] instanceof Date);
  });

  it("rejects participant references from another tenant", async () => {
    const service = createService({
      employee: { findMany: async () => [] },
      contractorWorker: { findMany: async () => [] },
      contractorOrganization: { findFirst: async () => null },
      branch: { findFirst: async () => null },
      department: { findFirst: async () => null },
      workSite: { findFirst: async () => null },
    });

    await assert.rejects(
      () =>
        (
          service as unknown as {
            validateReferences: (
              organizationId: string,
              input: Record<string, unknown>,
            ) => Promise<void>;
          }
        ).validateReferences("org-1", {
          issuerId: "foreign-employee",
          crew: { employeeIds: [], contractorWorkerIds: [] },
        }),
      (error) => error instanceof BadRequestException,
    );
  });

  it("rejects work permit links to contractor access acts from another organization", async () => {
    const service = createService({
      employee: { findMany: async () => [] },
      contractorWorker: { findMany: async () => [] },
      contractorOrganization: {
        findFirst: async () => ({ id: "contractor-1" }),
      },
      contractorAccessAct: { findFirst: async () => null },
      branch: { findFirst: async () => null },
      department: { findFirst: async () => null },
      workSite: { findFirst: async () => null },
    });

    await assert.rejects(
      () =>
        (
          service as unknown as {
            validateReferences: (
              organizationId: string,
              input: Record<string, unknown>,
            ) => Promise<void>;
          }
        ).validateReferences("org-1", {
          workType: "CONTRACTOR_SITE_ACCESS",
          contractorId: "contractor-1",
          contractorAccessActId: "foreign-act",
          startAt: "2026-06-06T08:00:00.000Z",
          endAt: "2026-06-06T12:00:00.000Z",
          crew: { employeeIds: [], contractorWorkerIds: [] },
        }),
      (error) => error instanceof BadRequestException,
    );
  });

  it("rejects work permit links to contractor access acts from another contractor", async () => {
    const service = createService({
      employee: { findMany: async () => [] },
      contractorWorker: { findMany: async () => [] },
      contractorOrganization: {
        findFirst: async () => ({ id: "contractor-1" }),
      },
      contractorAccessAct: {
        findFirst: async () => ({
          id: "act-1",
          actNumber: "CAA-1",
          status: "ACTIVE",
          validFrom: new Date("2026-06-06T07:00:00.000Z"),
          validTo: new Date("2026-06-06T13:00:00.000Z"),
          workArea: "Workshop A",
          contractorOrganizationId: "contractor-2",
          contractorRepresentativeId: null,
        }),
      },
      branch: { findFirst: async () => null },
      department: { findFirst: async () => null },
      workSite: { findFirst: async () => null },
    });

    await assert.rejects(
      () =>
        (
          service as unknown as {
            validateReferences: (
              organizationId: string,
              input: Record<string, unknown>,
            ) => Promise<void>;
          }
        ).validateReferences("org-1", {
          workType: "CONTRACTOR_SITE_ACCESS",
          contractorId: "contractor-1",
          contractorAccessActId: "act-1",
          startAt: "2026-06-06T08:00:00.000Z",
          endAt: "2026-06-06T12:00:00.000Z",
          crew: { employeeIds: [], contractorWorkerIds: [] },
        }),
      (error) => error instanceof BadRequestException,
    );
  });

  it("rejects work permit links to inactive contractor access acts", async () => {
    const service = createService({
      employee: { findMany: async () => [] },
      contractorWorker: { findMany: async () => [] },
      contractorOrganization: {
        findFirst: async () => ({ id: "contractor-1" }),
      },
      contractorAccessAct: {
        findFirst: async () => ({
          id: "act-1",
          actNumber: "CAA-1",
          status: "CLOSED",
          validFrom: new Date("2026-06-06T07:00:00.000Z"),
          validTo: new Date("2026-06-06T13:00:00.000Z"),
          workArea: "Workshop A",
          contractorOrganizationId: "contractor-1",
          contractorRepresentativeId: null,
        }),
      },
      branch: { findFirst: async () => null },
      department: { findFirst: async () => null },
      workSite: { findFirst: async () => null },
    });

    await assert.rejects(
      () =>
        (
          service as unknown as {
            validateReferences: (
              organizationId: string,
              input: Record<string, unknown>,
            ) => Promise<void>;
          }
        ).validateReferences("org-1", {
          workType: "CONTRACTOR_SITE_ACCESS",
          contractorId: "contractor-1",
          contractorAccessActId: "act-1",
          startAt: "2026-06-06T08:00:00.000Z",
          endAt: "2026-06-06T12:00:00.000Z",
          crew: { employeeIds: [], contractorWorkerIds: [] },
        }),
      (error) => error instanceof BadRequestException,
    );
  });

  for (const scenario of [
    {
      name: "inactive participants",
      employeeStatus: "inactive",
      expectedCode: "INTERNAL_EMPLOYEE_ACTIVE",
    },
    {
      name: "expired medical evidence",
      medicalExpiry: new Date("2026-06-05T00:00:00.000Z"),
      expectedCode: "MEDICAL_CLEARANCE_VALID",
    },
    {
      name: "archived internal employee",
      employeeArchived: true,
      expectedCode: "INTERNAL_EMPLOYEE_ACTIVE",
    },
  ]) {
    it(`fails precheck for ${scenario.name}`, async () => {
      const fixture = precheckPrisma(scenario);
      const service = createService(fixture.prisma);
      const internal = service as unknown as {
        findPermit: () => Promise<Record<string, unknown>>;
        assertAccess: () => Promise<null>;
        appendVersion: () => Promise<{ id: string }>;
        get: () => Promise<{ id: string }>;
      };
      internal.findPermit = async () => permitFixture(evidenceEntry);
      internal.assertAccess = async () => null;
      internal.appendVersion = async () => ({ id: "version-2" });
      internal.get = async () => ({ id: "permit-1" });

      await service.precheck(user, "permit-1");

      const data = fixture.getPrecheckData();
      assert.equal(data?.result, "FAIL");
      const checks = data?.checksJson as Array<{
        code: string;
        result: string;
      }>;
      assert.equal(
        checks.find((check) => check.code === scenario.expectedCode)?.result,
        "FAIL",
      );
    });
  }

  it("fails precheck when a contractor worker belongs to another contractor", async () => {
    const fixture = precheckPrisma({
      contractorWorkerContractorId: "contractor-2",
    });
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => ({
      ...permitFixture({
        ...evidenceEntry,
        ppeIssueRecordIds: ["ppe-1", "ppe-worker-1"],
      }),
      contractorOrganizationId: "contractor-1",
      contractorRepresentativeId: "worker-1",
      brigades: [
        {
          members: [
            {
              employeeId: "employee-1",
              contractorWorkerId: null,
            },
            {
              employeeId: null,
              contractorWorkerId: "worker-1",
            },
          ],
        },
      ],
    });
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    const checks = fixture.getPrecheckData()?.checksJson as Array<{
      code: string;
      result: string;
    }>;
    assert.equal(
      checks.find(
        (check) => check.code === "CONTRACTOR_WORKER_MATCHES_CONTRACTOR",
      )?.result,
      "FAIL",
    );
  });

  it("fails CONTRACTOR_SITE_ACCESS precheck without an active ContractorAccessAct", async () => {
    const fixture = precheckPrisma({
      contractorWorkerContractorId: "contractor-1",
    });
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => ({
      ...permitFixture({
        ...evidenceEntry,
        workType: "CONTRACTOR_SITE_ACCESS",
        ppeIssueRecordIds: ["ppe-1", "ppe-worker-1"],
      }),
      permitType: "CONTRACTOR_ACCESS",
      workType: "CONTRACTOR_SITE_ACCESS",
      contractorOrganizationId: "contractor-1",
      contractorRepresentativeId: "worker-1",
      contractorAccessActId: null,
      brigades: [
        {
          members: [
            { employeeId: "employee-1", contractorWorkerId: null },
            { employeeId: null, contractorWorkerId: "worker-1" },
          ],
        },
      ],
    });
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    const checks = fixture.getPrecheckData()?.checksJson as Array<{
      code: string;
      result: string;
    }>;
    assert.equal(
      checks.find((check) => check.code === "CONTRACTOR_ACCESS_ACT_PRESENT")
        ?.result,
      "FAIL",
    );
  });

  it("passes CONTRACTOR_SITE_ACCESS precheck with an active valid ContractorAccessAct", async () => {
    const fixture = precheckPrisma({
      contractorWorkerContractorId: "contractor-1",
      contractorAccessActStatus: "ACTIVE",
    });
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => ({
      ...permitFixture({
        ...evidenceEntry,
        workType: "CONTRACTOR_SITE_ACCESS",
        ppeIssueRecordIds: ["ppe-1", "ppe-worker-1"],
      }),
      permitType: "CONTRACTOR_ACCESS",
      workType: "CONTRACTOR_SITE_ACCESS",
      contractorOrganizationId: "contractor-1",
      contractorRepresentativeId: "worker-1",
      contractorAccessActId: "act-1",
      brigades: [
        {
          members: [
            { employeeId: "employee-1", contractorWorkerId: null },
            { employeeId: null, contractorWorkerId: "worker-1" },
          ],
        },
      ],
    });
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    const checks = fixture.getPrecheckData()?.checksJson as Array<{
      code: string;
      result: string;
    }>;
    assert.equal(
      checks.find(
        (check) => check.code === "CONTRACTOR_ACCESS_ACT_DATE_COVERAGE",
      )?.result,
      "PASS",
    );
  });

  for (const scenario of [
    {
      name: "inactive contractor worker",
      args: {
        contractorWorkerContractorId: "contractor-1",
        contractorWorkerStatus: "inactive",
      },
    },
    {
      name: "archived contractor worker",
      args: {
        contractorWorkerContractorId: "contractor-1",
        contractorWorkerArchived: true,
      },
    },
  ]) {
    it(`fails precheck for ${scenario.name}`, async () => {
      const data = await runPrecheckFixture(scenario.args, {
        contractorOrganizationId: "contractor-1",
        contractorRepresentativeId: "worker-1",
        brigades: [
          {
            members: [
              { employeeId: "employee-1", contractorWorkerId: null },
              { employeeId: null, contractorWorkerId: "worker-1" },
            ],
          },
        ],
      });
      const checks = data?.checksJson as Array<{
        code: string;
        result: string;
      }>;
      assert.equal(
        checks.find((check) => check.code === "CONTRACTOR_WORKER_ACTIVE")
          ?.result,
        "FAIL",
      );
    });
  }

  it("fails precheck when an explicit evidence ID does not exist", async () => {
    const fixture = precheckPrisma({});
    fixture.prisma.employeeDocument.findMany = async () => [];
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => permitFixture(evidenceEntry);
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    const checks = fixture.getPrecheckData()?.checksJson as Array<{
      code: string;
      result: string;
      evidenceIds: string[];
    }>;
    const qualification = checks.find(
      (check) => check.code === "QUALIFICATION_OR_CERTIFICATE_VALID",
    );
    assert.equal(qualification?.result, "FAIL");
    assert.deepEqual(qualification?.evidenceIds, []);
  });

  it("fails precheck for expired PPE evidence required by explicit IDs", async () => {
    const data = await runPrecheckFixture({
      ppeExpiry: new Date("2026-06-05T00:00:00.000Z"),
    });
    const checks = data?.checksJson as Array<{
      code: string;
      result: string;
      severity: string;
    }>;
    const ppeCheck = checks.find((check) => check.code === "PPE_ISSUED_VALID");
    assert.equal(ppeCheck?.result, "FAIL");
    assert.equal(ppeCheck?.severity, "BLOCKER");
  });

  for (const scenario of [
    {
      name: "inactive act",
      args: {
        contractorWorkerContractorId: "contractor-1",
        contractorAccessActStatus: "CLOSED",
      },
      code: "CONTRACTOR_ACCESS_ACT_ACTIVE",
    },
    {
      name: "expired act",
      args: {
        contractorWorkerContractorId: "contractor-1",
        contractorAccessActStatus: "ACTIVE",
        contractorAccessActValidTo: new Date("2026-06-06T10:00:00.000Z"),
      },
      code: "CONTRACTOR_ACCESS_ACT_DATE_COVERAGE",
    },
    {
      name: "wrong-contractor act",
      args: {
        contractorWorkerContractorId: "contractor-1",
        contractorAccessActStatus: "ACTIVE",
        contractorAccessActContractorId: "contractor-2",
      },
      code: "CONTRACTOR_ACCESS_ACT_DATE_COVERAGE",
    },
  ]) {
    it(`fails CONTRACTOR_SITE_ACCESS precheck with ${scenario.name}`, async () => {
      const data = await runPrecheckFixture(scenario.args, {
        permitType: "CONTRACTOR_ACCESS",
        workType: "CONTRACTOR_SITE_ACCESS",
        contractorOrganizationId: "contractor-1",
        contractorRepresentativeId: "worker-1",
        contractorAccessActId: "act-1",
        brigades: [
          {
            members: [
              { employeeId: "employee-1", contractorWorkerId: null },
              { employeeId: null, contractorWorkerId: "worker-1" },
            ],
          },
        ],
      });
      const checks = data?.checksJson as Array<{
        code: string;
        result: string;
      }>;
      assert.equal(
        checks.find((check) => check.code === scenario.code)?.result,
        "FAIL",
      );
    });
  }

  it("allows warning-only precheck results to pass", async () => {
    const data = await runPrecheckFixture(
      {},
      {
        currentVersion: {
          id: "version-1",
          payloadHash: "payload-hash-1",
          documentVersionId: "document-version-1",
          payloadJson: {
            permitEntry: {
              ...evidenceEntry,
              trainingEvidenceIds: [],
            },
          },
        },
      },
    );
    assert.equal(data?.result, "PASS");
    const checks = data?.checksJson as Array<{
      code: string;
      result: string;
      severity: string;
    }>;
    const trainingCheck = checks.find(
      (check) => check.code === "TRAINING_EVIDENCE_VALID",
    );
    assert.equal(trainingCheck?.result, "FAIL");
    assert.equal(trainingCheck?.severity, "WARNING");
  });

  it("keeps medical snapshot status-only and diagnosis-free", async () => {
    const fixture = precheckPrisma({});
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => permitFixture(evidenceEntry);
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    const snapshots = fixture.getPrecheckData()?.snapshotsJson as {
      medicalCheckSnapshot?: {
        containsDiagnosis?: boolean;
        evidence?: Array<Record<string, unknown>>;
      };
    };
    assert.equal(snapshots.medicalCheckSnapshot?.containsDiagnosis, false);
    const forbiddenKeys = new Set([
      "diagnosis",
      "diagnoses",
      "medicaldetails",
      "healthcondition",
      "rawpayload",
    ]);
    const hasForbiddenKey = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(hasForbiddenKey);
      if (!value || typeof value !== "object") return false;
      return Object.entries(value).some(
        ([key, nested]) =>
          forbiddenKeys.has(key.toLowerCase()) || hasForbiddenKey(nested),
      );
    };
    assert.equal(hasForbiddenKey(snapshots.medicalCheckSnapshot), false);
  });

  it("scopes every precheck record lookup to the permit organization", async () => {
    const fixture = precheckPrisma({});
    let employeeWhere: Record<string, unknown> | null = null;
    const employeeModel = fixture.prisma.employee as {
      findMany: (args?: {
        where: Record<string, unknown>;
      }) => Promise<Array<{ id: string; status: string; isArchived: boolean }>>;
    };
    const originalFindMany = employeeModel.findMany;
    employeeModel.findMany = async (args) => {
      employeeWhere = args?.where ?? null;
      return originalFindMany();
    };
    const service = createService(fixture.prisma);
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      assertAccess: () => Promise<null>;
      appendVersion: () => Promise<{ id: string }>;
      get: () => Promise<{ id: string }>;
    };
    internal.findPermit = async () => permitFixture(evidenceEntry);
    internal.assertAccess = async () => null;
    internal.appendVersion = async () => ({ id: "version-2" });
    internal.get = async () => ({ id: "permit-1" });

    await service.precheck(user, "permit-1");

    assert.ok(employeeWhere);
    assert.equal((employeeWhere as Record<string, unknown>).companyId, "org-1");
  });

  for (const scenario of [
    { name: "latest precheck is FAIL", runResult: "FAIL", changed: false },
    { name: "payload changed after PASS", runResult: "PASS", changed: true },
  ]) {
    it(`blocks activation when ${scenario.name}`, async () => {
      const service = createService({
        workPermit: { update: async () => undefined },
      });
      const internal = service as unknown as {
        findPermit: () => Promise<Record<string, unknown>>;
        transition: () => Promise<void>;
        precheckPayloadHash: (entry: Record<string, unknown>) => string;
      };
      const checkedEntry = { ...evidenceEntry };
      const payloadHash = internal.precheckPayloadHash(checkedEntry);
      internal.findPermit = async () => ({
        ...permitFixture({
          ...checkedEntry,
          workDescription: scenario.changed ? "Changed work" : "Maintenance",
          precheckSummary: {
            result: "PASS",
            checkedAt: "2026-06-06T07:50:00.000Z",
            failedRules: [],
            payloadHash,
          },
        }),
        status: "SIGNED",
        precheckRuns: [{ result: scenario.runResult }],
      });
      internal.transition = async () => undefined;

      await assert.rejects(
        () => service.activate(user, "permit-1", {}),
        (error) => error instanceof BadRequestException,
      );
    });
  }

  it("allows activation with a current PASS precheck, including warnings", async () => {
    let transitioned = false;
    const service = createService({
      workPermit: { update: async () => undefined },
    });
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
      transition: () => Promise<void>;
      get: () => Promise<Record<string, unknown>>;
      precheckPayloadHash: (entry: Record<string, unknown>) => string;
    };
    const payloadHash = internal.precheckPayloadHash(evidenceEntry);
    internal.findPermit = async () => ({
      ...permitFixture({
        ...evidenceEntry,
        precheckSummary: {
          result: "PASS",
          checkedAt: "2026-06-06T07:50:00.000Z",
          failedRules: ["TRAINING_EVIDENCE_VALID"],
          warningCount: 1,
          blockerCount: 0,
          payloadHash,
        },
      }),
      status: "SIGNED",
      precheckRuns: [{ result: "PASS" }],
    });
    internal.transition = async () => {
      transitioned = true;
    };
    internal.get = async () => ({ id: "permit-1" });

    await service.activate(user, "permit-1", {});

    assert.equal(transitioned, true);
  });

  it("rejects an unrelated employee signer before running precheck queries", async () => {
    const service = createService({
      employee: { findFirst: async () => null },
    });
    const internal = service as unknown as {
      findPermit: () => Promise<Record<string, unknown>>;
    };
    internal.findPermit = async () => permitFixture(evidenceEntry);

    await assert.rejects(
      () =>
        service.precheck(
          { ...user, role: "EMPLOYEE_SIGNER", userId: "other-user" },
          "permit-1",
        ),
      (error) => error instanceof ForbiddenException,
    );
  });

  it("generates a draft PDF marker without persisting an export snapshot", async () => {
    const permit = permitFixture({
      ...evidenceEntry,
      medicalCheckSnapshot: {
        containsDiagnosis: false,
        diagnosis: "must never be rendered",
      },
    });
    const fixture = createArtifactService({ permit });

    const pdf = await fixture.service.download(user, "permit-1");

    assert.ok(pdf.length > 0);
    assert.equal(fixture.rendered[0]?.draft, true);
    assert.equal(fixture.snapshots.length, 0);
    assert.equal(
      JSON.stringify(fixture.rendered[0]).includes("must never be rendered"),
      false,
    );
  });

  it("uses the frozen current version payload and creates PDF_A_1 for a signed permit", async () => {
    const permit = {
      ...permitFixture({
        ...evidenceEntry,
        workDescription: "Frozen signed work description",
      }),
      status: "SIGNED",
      workDescription: "Mutable database description",
      documentEnvelopeId: "envelope-1",
      signedPayloadHash: "signed-payload-hash",
      documentEnvelope: {
        signatures: [],
        archiveRecords: [],
        exportSnapshots: [],
      },
    };
    const fixture = createArtifactService({ permit });

    await fixture.service.download(user, "permit-1");

    assert.equal(
      fixture.rendered[0]?.workDescription,
      "Frozen signed work description",
    );
    assert.equal(fixture.snapshots.length, 1);
    assert.equal(fixture.snapshots[0]?.format, "PDF_A_1");
    assert.equal(fixture.snapshots[0]?.versionId, "document-version-1");
    assert.equal(typeof fixture.snapshots[0]?.sha256, "string");
  });

  it("builds a safe permit evidence manifest with hashes, precheck, audit, and contractor act", async () => {
    const permit = {
      ...permitFixture({
        ...evidenceEntry,
        medicalCheckSnapshot: {
          containsDiagnosis: false,
          diagnosis: "private diagnosis",
          medicalDetails: "private details",
          rawPayload: "private raw payload",
        },
      }),
      status: "ACTIVE",
      documentEnvelopeId: "envelope-1",
      contractorOrganizationId: "contractor-1",
      contractorAccessActId: "act-1",
      precheckRuns: [
        {
          id: "precheck-1",
          result: "PASS",
          checkedAt: new Date("2026-06-06T07:50:00.000Z"),
          snapshotHash: "precheck-snapshot-hash",
          versionId: "version-1",
          checksJson: [
            {
              code: "SAFETY_MEASURES_PRESENT",
              result: "PASS",
              severity: "BLOCKER",
              message: "Safety measures are present.",
              evidenceIds: [],
            },
          ],
        },
      ],
      contractorAccessAct: {
        id: "act-1",
        actNumber: "ACT-1",
        status: "ACTIVE",
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validTo: new Date("2026-12-31T00:00:00.000Z"),
        workArea: "Workshop A",
        contractorOrganizationId: "contractor-1",
        contractorRepresentativeId: null,
        contractorOrganization: {
          id: "contractor-1",
          name: "Contractor LLP",
        },
        contractorRepresentative: null,
      },
      documentEnvelope: {
        signatures: [],
        archiveRecords: [],
        exportSnapshots: [],
      },
    };
    const fixture = createArtifactService({
      permit,
      genericEvidence: {
        document: {},
        signatures: [
          {
            id: "signature-1",
            provider: "NCALAYER",
            status: "SIGNED",
            createdAt: new Date("2026-06-06T08:00:00.000Z"),
            signedAt: new Date("2026-06-06T08:01:00.000Z"),
            signerUserId: "user-1",
            signerEmployeeId: "employee-1",
            signerRole: "PERMIT_ISSUER",
            signerName: "Safe Signer",
            certificateMetadataId: "certificate-1",
            certificateSerial: "SERIAL-1",
            certificateMetadata: {
              id: "certificate-1",
              serial: "SERIAL-1",
              thumbprint: "THUMBPRINT-1",
              validFrom: new Date("2026-01-01T00:00:00.000Z"),
              validTo: new Date("2027-01-01T00:00:00.000Z"),
              subjectDn: "sensitive subject",
            },
            verification: {
              result: "VALID",
              checkedAt: new Date("2026-06-06T08:02:00.000Z"),
              chainStatus: "VALID",
              revocationStatus: "GOOD",
              evidenceJson: { rawProviderPayload: "secret" },
            },
            payload: { rawCms: "secret" },
          },
        ],
        exportSnapshots: [
          {
            id: "pdf-snapshot-1",
            format: "PDF_A_1",
            sha256: "pdf-hash-1",
            storageUri: "generated://pdf",
            versionId: "document-version-1",
            generatedAt: new Date("2026-06-06T08:03:00.000Z"),
          },
        ],
        archiveRecords: [],
        generatedAt: new Date(),
      },
    });

    const manifest = await fixture.service.evidence(user, "permit-1");
    const serialized = JSON.stringify(manifest);

    assert.equal(manifest.hashes.generatedPdfHash, "pdf-hash-1");
    assert.equal(manifest.precheck?.latestRunId, "precheck-1");
    assert.equal(manifest.contractorAccessAct?.actNumber, "ACT-1");
    assert.equal(manifest.medicalPrivacy.containsDiagnosis, false);
    for (const forbidden of [
      "private diagnosis",
      "private details",
      "private raw payload",
      "rawCms",
      "rawProviderPayload",
      "sensitive subject",
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  it("rejects archive before a closed, expired, or cancelled state", async () => {
    const permit = {
      ...permitFixture(evidenceEntry),
      status: "ACTIVE",
    };
    const fixture = createArtifactService({ permit });

    await assert.rejects(
      () => fixture.service.archive(user, "permit-1"),
      (error) => error instanceof ConflictException,
    );
  });

  it("seals a closed permit archive with the evidence manifest hash", async () => {
    const permit = {
      ...permitFixture(evidenceEntry),
      status: "CLOSED",
      closedAt: new Date("2026-06-06T12:00:00.000Z"),
      documentEnvelopeId: "envelope-1",
      closure: {
        result: "Completed",
        inspection: "Workplace inspected",
        notes: null,
        closedByUserId: "user-1",
        payloadHash: "closure-hash",
        closedAt: new Date("2026-06-06T12:00:00.000Z"),
      },
      documentEnvelope: {
        signatures: [],
        archiveRecords: [],
        exportSnapshots: [],
      },
    };
    const fixture = createArtifactService({ permit });

    await fixture.service.archive(user, "permit-1");

    assert.equal(fixture.archiveRecords.length, 1);
    assert.equal(
      fixture.archiveRecords[0]?.archiveManifestHash,
      fixture.archiveRecords[0]?.storageUri?.toString().split("/").at(-1),
    );
    assert.equal(fixture.snapshots[0]?.format, "PDF_A_1");
  });

  it("keeps permit PDF access organization scoped", async () => {
    const permit = {
      ...permitFixture(evidenceEntry),
      organizationId: "org-2",
    };
    const fixture = createArtifactService({ permit });

    await assert.rejects(
      () => fixture.service.download(user, "permit-1"),
      (error) => error instanceof ForbiddenException,
    );
    assert.equal(fixture.rendered.length, 0);
  });
});
