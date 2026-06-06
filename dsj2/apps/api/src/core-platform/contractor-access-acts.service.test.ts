import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { ContractorAccessActsService } from "./contractor-access-acts.service";

const user = {
  userId: "user-1",
  companyId: "org-1",
  email: "admin@example.com",
  fullName: "Admin",
  role: "COMPANY_ADMIN" as const,
};

function createService(prisma: Record<string, unknown>) {
  return new ContractorAccessActsService(
    prisma as never,
    { log: async () => undefined } as never,
    {
      ensureRetentionPolicyResolved: async () => ({
        policy: { id: "retention-1" },
      }),
      createArchiveRecord: async () => ({ id: "archive-1" }),
    } as never,
  );
}

function actFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "act-1",
    organizationId: "org-1",
    actNumber: "CAA-1",
    status: "DRAFT",
    scopeType: "ORGANIZATION",
    branchId: null,
    departmentId: null,
    workSiteId: null,
    contractorOrganizationId: "contractor-1",
    contractorRepresentativeId: "worker-1",
    hostRepresentativeEmployeeId: "host-1",
    hostUnitChiefEmployeeId: "chief-1",
    workName: "Contractor maintenance",
    workDescription: null,
    workArea: "Workshop A",
    workAreaBoundaries: null,
    workAreaCoordinates: null,
    validFrom: new Date("2026-06-06T08:00:00.000Z"),
    validTo: new Date("2026-06-07T08:00:00.000Z"),
    safetyMeasures: ["Fence area"],
    specialConditions: null,
    legalBasis: "Приказ МТСЗН РК от 28.08.2020 №344, Приложение 3",
    legalBasisVersion: "KZ_ORDER_344_APPENDIX_3",
    legalBasisEffectiveDate: new Date("2020-08-28T00:00:00.000Z"),
    documentEnvelopeId: "envelope-1",
    currentVersionId: "version-1",
    signedAt: null,
    closedAt: null,
    cancelledAt: null,
    archivedAt: null,
    archiveRecordId: null,
    retentionPolicyId: null,
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    branch: null,
    workSite: null,
    contractorOrganization: { id: "contractor-1", name: "Contractor LLP" },
    contractorRepresentative: { id: "worker-1", fullName: "Worker" },
    hostRepresentativeEmployee: { id: "host-1", fullName: "Host" },
    hostUnitChiefEmployee: { id: "chief-1", fullName: "Chief" },
    documentEnvelope: null,
    currentVersion: { id: "version-1", renderedHash: "hash-1" },
    archiveRecord: null,
    workPermits: [],
    ...overrides,
  };
}

const validInput = {
  organizationId: "org-1",
  actNumber: "CAA-1",
  scopeType: "ORGANIZATION" as const,
  branchId: null,
  departmentId: null,
  workSiteId: null,
  contractorOrganizationId: "contractor-1",
  contractorRepresentativeId: "worker-1",
  hostRepresentativeEmployeeId: "host-1",
  hostUnitChiefEmployeeId: "chief-1",
  workName: "Contractor maintenance",
  workDescription: null,
  workArea: "Workshop A",
  workAreaBoundaries: null,
  workAreaCoordinates: null,
  validFrom: "2026-06-06T08:00:00.000Z",
  validTo: "2026-06-07T08:00:00.000Z",
  safetyMeasures: ["Fence area"],
  specialConditions: null,
};

function referencePrisma(args: {
  representativeContractorId?: string;
  representativeStatus?: string;
} = {}) {
  return {
    contractorOrganization: {
      findFirst: async () => ({ id: "contractor-1" }),
    },
    contractorWorker: {
      findFirst: async () => ({
        id: "worker-1",
        status: args.representativeStatus ?? "active",
        contractorOrganizationId:
          args.representativeContractorId ?? "contractor-1",
      }),
    },
    employee: {
      findMany: async () => [
        { id: "host-1", status: "active" },
        { id: "chief-1", status: "active" },
      ],
    },
    branch: { findFirst: async () => null },
    department: { findFirst: async () => null },
    workSite: { findFirst: async () => null },
  };
}

describe("contractor access acts service", () => {
  it("creates a ContractorAccessAct draft with Appendix 3 legal basis", async () => {
    let createdAct: Record<string, unknown> | null = null;
    const service = createService({
      ...referencePrisma(),
      $transaction: async (
        callback: (transaction: Record<string, unknown>) => Promise<unknown>,
      ) =>
        callback({
          documentEnvelope: {
            create: async () => undefined,
            update: async () => undefined,
          },
          documentVersion: { create: async () => undefined },
          contractorAccessAct: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              createdAct = data;
            },
          },
        }),
      contractorAccessAct: {
        findUnique: async () => actFixture(),
      },
      workPermit: { findFirst: async () => null },
    });

    await service.create(user, validInput);

    assert.ok(createdAct);
    const actData = createdAct as Record<string, unknown>;
    assert.equal(actData.status, "DRAFT");
    assert.equal(actData.legalBasisVersion, "KZ_ORDER_344_APPENDIX_3");
    assert.equal(
      actData.legalBasis,
      "Приказ МТСЗН РК от 28.08.2020 №344, Приложение 3",
    );
  });

  it("maps duplicate actNumber per organization to conflict", async () => {
    const service = createService({
      ...referencePrisma(),
      $transaction: async () => {
        throw { code: "P2002", meta: { target: ["organizationId", "actNumber"] } };
      },
    });

    await assert.rejects(
      () => service.create(user, validInput),
      (error) => error instanceof ConflictException,
    );
  });

  it("allows update only in DRAFT", async () => {
    const service = createService({
      contractorAccessAct: {
        findUnique: async () => actFixture({ status: "ACTIVE" }),
      },
    });

    await assert.rejects(
      () => service.update(user, "act-1", { workArea: "Updated area" }),
      (error) => error instanceof ConflictException,
    );
  });

  it("activation validation requires valid dates and contractor scope", async () => {
    const service = createService(referencePrisma());
    const internal = service as unknown as {
      validateReferences: (
        organizationId: string,
        input: Record<string, unknown>,
      ) => Promise<unknown>;
    };

    await assert.rejects(
      () =>
        internal.validateReferences("org-1", {
          ...validInput,
          validTo: "2026-06-06T07:00:00.000Z",
        }),
      (error) => error instanceof BadRequestException,
    );
  });

  it("requires contractorRepresentative to belong to selected contractor", async () => {
    const service = createService(
      referencePrisma({ representativeContractorId: "contractor-2" }),
    );
    const internal = service as unknown as {
      validateReferences: (
        organizationId: string,
        input: Record<string, unknown>,
      ) => Promise<unknown>;
    };

    await assert.rejects(
      () => internal.validateReferences("org-1", validInput),
      (error) => error instanceof BadRequestException,
    );
  });

  it("blocks employee signer access to unrelated ContractorAccessAct", async () => {
    const service = createService({
      contractorAccessAct: { findUnique: async () => actFixture() },
      employee: { findFirst: async () => ({ id: "employee-1" }) },
      workPermit: { findFirst: async () => null },
    });

    await assert.rejects(
      () =>
        service.get(
          {
            ...user,
            userId: "signer-user",
            role: "EMPLOYEE_SIGNER",
          },
          "act-1",
        ),
      (error) => error instanceof ForbiddenException,
    );
  });

  it("list respects organization scope", async () => {
    let where: Record<string, unknown> | null = null;
    const service = createService({
      contractorAccessAct: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
        count: async () => 0,
      },
    });

    await service.list(user, {
      organizationId: "org-1",
      page: 1,
      pageSize: 25,
    });

    assert.ok(where);
    const whereData = where as Record<string, unknown>;
    assert.equal(whereData.organizationId, "org-1");
  });
});
