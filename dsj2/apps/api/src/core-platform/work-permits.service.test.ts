import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
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

function permitFixture(entry: Record<string, unknown>) {
  return {
    id: "permit-1",
    organizationId: "org-1",
    status: "DRAFT",
    permitCode: String(entry.permitNumber ?? "WP-1"),
    journalRegistrationNumber: String(entry.journalRegistrationNumber ?? "PJ-1"),
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
      payloadJson: {
        permitEntry: entry,
      },
    },
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
  medicalExpiry?: Date;
  contractorWorkerContractorId?: string;
  contractorAccessActStatus?: string;
  contractorAccessActContractorId?: string;
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
          status: "active",
          isArchived: false,
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
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
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
          isArchived: false,
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
    qualificationDocument: { findMany: async () => [] },
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
              validTo: new Date("2026-06-06T13:00:00.000Z"),
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
  legalBasis: ["HIGH_RISK_PERMIT_RULES_344"],
  trainingEvidenceIds: ["training-1"],
  briefingEvidenceIds: ["briefing-1"],
  certificateEvidenceIds: ["certificate-1"],
  medicalEvidenceIds: ["medical-1"],
  requiredDocumentIds: ["required-1"],
  ppeIssueRecordIds: ["ppe-1"],
};

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
    assert.equal(entry.workplacePreparationMeasures, "Stop and isolate equipment.");
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
    assert.equal((listCalls[1].where as Record<string, unknown>).status, "ACTIVE");
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
      transition: () => Promise<void>;
      get: () => Promise<Record<string, unknown>>;
    };
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
      contractorOrganization: { findFirst: async () => ({ id: "contractor-1" }) },
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
      contractorOrganization: { findFirst: async () => ({ id: "contractor-1" }) },
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
      contractorOrganization: { findFirst: async () => ({ id: "contractor-1" }) },
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
      expectedCode: "ACTIVE_PARTICIPANTS",
    },
    {
      name: "expired medical evidence",
      medicalExpiry: new Date("2026-06-05T00:00:00.000Z"),
      expectedCode: "MEDICAL_CLEARANCE",
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
      checks.find((check) => check.code === "CONTRACTOR_WORKERS")?.result,
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
      checks.find((check) => check.code === "CONTRACTOR_ACCESS_ACT")?.result,
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
      checks.find((check) => check.code === "CONTRACTOR_ACCESS_ACT")?.result,
      "PASS",
    );
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
    assert.equal(
      snapshots.medicalCheckSnapshot?.evidence?.some((item) =>
        Object.keys(item).some((key) => key.toLowerCase().includes("diagnos")),
      ),
      false,
    );
  });
});
