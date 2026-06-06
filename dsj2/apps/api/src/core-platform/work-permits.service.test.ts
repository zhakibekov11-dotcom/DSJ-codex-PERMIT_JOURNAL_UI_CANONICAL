import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
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
    permitType: "HIGH_RISK_WORK",
    workType: "GENERAL_HIGH_RISK",
    workSiteId: null,
    contractorOrganizationId: null,
    contractorRepresentativeId: null,
    issuerEmployeeId: null,
    responsibleManagerEmployeeId: null,
    workProducerEmployeeId: null,
    admitterEmployeeId: null,
    observerEmployeeId: null,
    effectiveFrom: new Date("2026-06-06T08:00:00.000Z"),
    effectiveTo: new Date("2026-06-06T12:00:00.000Z"),
    currentVersion: {
      payloadJson: {
        permitEntry: entry,
      },
    },
    brigades: [
      {
        members: [
          {
            employeeId: "employee-1",
            contractorWorkerId: null,
          },
        ],
      },
    ],
  };
}

function precheckPrisma(args: {
  employeeStatus?: string;
  medicalExpiry?: Date;
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
    contractorWorker: { findMany: async () => [] },
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
      findMany: async () => [
        {
          id: "ppe-1",
          employeeId: "employee-1",
          contractorWorkerId: null,
          itemCode: "HELMET",
          status: "ACTIVE",
          issuedAt: new Date("2026-01-01T00:00:00.000Z"),
          validUntil: new Date("2027-01-01T00:00:00.000Z"),
        },
      ],
    },
    workSite: { findFirst: async () => null },
    contractorOrganization: { findFirst: async () => null },
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
  trainingEvidenceIds: ["training-1"],
  briefingEvidenceIds: ["briefing-1"],
  certificateEvidenceIds: ["certificate-1"],
  medicalEvidenceIds: ["medical-1"],
  requiredDocumentIds: ["required-1"],
  ppeIssueRecordIds: ["ppe-1"],
};

describe("work permit service guards", () => {
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
});
