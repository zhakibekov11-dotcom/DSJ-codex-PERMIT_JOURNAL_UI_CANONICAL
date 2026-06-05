import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { EmployeesService } from "./employees.service";

process.env.FIELD_ENCRYPTION_KEY ??= "wave-2-test-key";
process.env.FIELD_HASH_PEPPER ??= "wave-2-test-pepper";

const adminUser: AuthenticatedUser = {
  userId: "user-admin-1",
  companyId: "company-1",
  email: "admin@example.com",
  fullName: "Admin User",
  role: "COMPANY_ADMIN",
};

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    companyId: "company-1",
    departmentId: "department-1",
    siteId: "site-1",
    contractorCompanyId: null,
    fullName: "Aigerim Sadykova",
    iin: "980317350011",
    employeeNumber: "EMP-001",
    jobTitle: "Safety Engineer",
    jobTitleKz: "Safety Engineer KZ",
    email: null,
    phone: null,
    employeeKind: "INTERNAL",
    status: "active",
    createAccount: false,
    accountPassword: null,
    ...overrides,
  };
}

function createExistingEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: "employee-1",
    companyId: "company-1",
    departmentId: "department-1",
    siteId: "site-1",
    userId: null,
    contractorCompanyId: null,
    fullName: "Aigerim Sadykova",
    employeeNumber: "EMP-001",
    jobTitle: "Safety Engineer",
    jobTitleKz: "Safety Engineer KZ",
    photoDataUrl: null,
    photoFileName: null,
    email: null,
    phone: null,
    employeeKind: "INTERNAL",
    status: "active",
    user: null,
    ...overrides,
  };
}

function createService(options?: {
  departments?: string[];
  duplicateEmployee?: Record<string, unknown> | null;
  employeeCreateError?: Error;
  existingEmployee?: Record<string, unknown>;
  sites?: string[];
}) {
  const state: {
    employeeCreateData: Record<string, unknown> | null;
    employeeFindFirstWhere: unknown;
    employeeUpdateData: Record<string, unknown> | null;
    transactionCalls: number;
  } = {
    employeeCreateData: null,
    employeeFindFirstWhere: null,
    employeeUpdateData: null,
    transactionCalls: 0,
  };
  const departments = new Set(
    options?.departments ?? ["department-1", "department-2"],
  );
  const sites = new Set(options?.sites ?? ["site-1", "site-2"]);

  const prisma = {
    contractorCompany: {
      findFirst: async () => null,
    },
    department: {
      findFirst: async ({
        where,
      }: {
        where: { companyId: string; id: string };
      }) =>
        where.companyId === "company-1" && departments.has(where.id)
          ? { id: where.id, companyId: where.companyId }
          : null,
    },
    site: {
      findFirst: async ({
        where,
      }: {
        where: { companyId: string; id: string };
      }) =>
        where.companyId === "company-1" && sites.has(where.id)
          ? { id: where.id, companyId: where.companyId }
          : null,
    },
    employee: {
      findFirst: async ({ where }: { where: unknown }) => {
        state.employeeFindFirstWhere = where;
        return options?.duplicateEmployee ?? null;
      },
    },
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => {
      state.transactionCalls += 1;

      return callback({
        user: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: "user-employee-1",
            ...data,
          }),
          findUnique: async () => null,
          update: async () => null,
        },
        employee: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            if (options?.employeeCreateError) {
              throw options.employeeCreateError;
            }

            state.employeeCreateData = data;
            return {
              id: "employee-1",
              employeeNumber: String(data.employeeNumber),
              fullName: String(data.fullName),
              employeeKind: String(data.employeeKind),
            };
          },
          update: async ({ data }: { data: Record<string, unknown> }) => {
            state.employeeUpdateData = data;
            return {
              id: "employee-1",
            };
          },
        },
      });
    },
  };

  const service = new EmployeesService(
    prisma as never,
    {
      log: async () => undefined,
    } as never,
  );

  (service as any).findOne = async (_user: AuthenticatedUser, id: string) => ({
    id,
    departmentId:
      (state.employeeUpdateData?.departmentId as string | null | undefined) ??
      (state.employeeCreateData?.departmentId as string | null | undefined) ??
      null,
    siteId:
      (state.employeeUpdateData?.siteId as string | null | undefined) ??
      (state.employeeCreateData?.siteId as string | null | undefined) ??
      null,
  });

  if (options?.existingEmployee) {
    (service as any).findRawById = async () => options.existingEmployee;
  }

  return {
    service,
    state,
  };
}

test("employees create rejects a department from another company", async () => {
  const { service, state } = createService({
    departments: ["department-1"],
  });

  await assert.rejects(
    () =>
      service.create(
        adminUser,
        createInput({
          departmentId: "department-foreign",
        }) as never,
      ),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(state.transactionCalls, 0);
});

test("employees create pre-checks current and legacy IIN hashes", async () => {
  const { service, state } = createService();

  await service.create(adminUser, createInput() as never);

  const where = state.employeeFindFirstWhere as {
    companyId: string;
    iinHash: { in: string[] };
  };

  assert.equal(where.companyId, "company-1");
  assert.equal(where.iinHash.in.length, 2);
  assert.notEqual(where.iinHash.in[0], where.iinHash.in[1]);
});

test("employees create rejects duplicate IIN hashes before writing", async () => {
  const { service, state } = createService({
    duplicateEmployee: {
      id: "employee-duplicate",
    },
  });

  await assert.rejects(
    () => service.create(adminUser, createInput() as never),
    (error) => error instanceof ConflictException,
  );

  assert.equal(state.transactionCalls, 0);
});

test("employees create accepts same-company department and site", async () => {
  const { service, state } = createService();

  const employee = await service.create(
    adminUser,
    createInput({
      departmentId: "department-2",
      siteId: "site-2",
    }) as never,
  );

  assert.equal(state.transactionCalls, 1);
  assert.equal(state.employeeCreateData?.departmentId, "department-2");
  assert.equal(state.employeeCreateData?.siteId, "site-2");
  assert.deepEqual(employee, {
    id: "employee-1",
    departmentId: "department-2",
    siteId: "site-2",
  });
});

test("employees create accepts an empty Kazakh job title", async () => {
  const { service, state } = createService();

  await service.create(
    adminUser,
    createInput({
      jobTitleKz: null,
    }) as never,
  );

  assert.equal(state.employeeCreateData?.jobTitle, "Safety Engineer");
  assert.equal(state.employeeCreateData?.jobTitleKz, null);
});

test("employees create maps duplicate employee numbers to conflict errors", async () => {
  const { service } = createService({
    employeeCreateError: new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: ["companyId", "employeeNumber"],
        },
      },
    ),
  });

  await assert.rejects(
    () => service.create(adminUser, createInput() as never),
    (error) => error instanceof ConflictException,
  );
});

test("employees update rejects a carried foreign site reference", async () => {
  const { service, state } = createService({
    existingEmployee: createExistingEmployee({
      siteId: "site-foreign",
    }),
    sites: ["site-1", "site-2"],
  });

  await assert.rejects(
    () =>
      service.update(adminUser, "employee-1", {
        fullName: "Updated Name",
      } as never),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(state.transactionCalls, 0);
});

test("employees update accepts same-company department and site", async () => {
  const { service, state } = createService({
    existingEmployee: createExistingEmployee(),
  });

  const employee = await service.update(adminUser, "employee-1", {
    departmentId: "department-2",
    siteId: "site-2",
    fullName: "Updated Name",
  } as never);

  assert.equal(state.transactionCalls, 1);
  assert.equal(state.employeeUpdateData?.departmentId, "department-2");
  assert.equal(state.employeeUpdateData?.siteId, "site-2");
  assert.deepEqual(employee, {
    id: "employee-1",
    departmentId: "department-2",
    siteId: "site-2",
  });
});

test("employees update can clear the Kazakh job title", async () => {
  const { service, state } = createService({
    existingEmployee: createExistingEmployee({
      jobTitleKz: "Existing KZ",
    }),
  });

  await service.update(adminUser, "employee-1", {
    jobTitleKz: null,
  } as never);

  assert.equal(state.employeeUpdateData?.jobTitleKz, null);
});
