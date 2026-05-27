import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { EmployeesService } from "./employees.service";

process.env.FIELD_ENCRYPTION_KEY ??= "wave-2-test-key";

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
  existingEmployee?: Record<string, unknown>;
  sites?: string[];
}) {
  const state: {
    employeeCreateData: Record<string, unknown> | null;
    employeeUpdateData: Record<string, unknown> | null;
    transactionCalls: number;
  } = {
    employeeCreateData: null,
    employeeUpdateData: null,
    transactionCalls: 0,
  };
  const departments = new Set(options?.departments ?? ["department-1", "department-2"]);
  const sites = new Set(options?.sites ?? ["site-1", "site-2"]);

  const prisma = {
    contractorCompany: {
      findFirst: async () => null,
    },
    department: {
      findFirst: async ({ where }: { where: { companyId: string; id: string } }) =>
        where.companyId === "company-1" && departments.has(where.id)
          ? { id: where.id, companyId: where.companyId }
          : null,
    },
    site: {
      findFirst: async ({ where }: { where: { companyId: string; id: string } }) =>
        where.companyId === "company-1" && sites.has(where.id)
          ? { id: where.id, companyId: where.companyId }
          : null,
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

test("employees update rejects a carried foreign site reference", async () => {
  const { service, state } = createService({
    existingEmployee: createExistingEmployee({
      siteId: "site-foreign",
    }),
    sites: ["site-1", "site-2"],
  });

  await assert.rejects(
    () =>
      service.update(
        adminUser,
        "employee-1",
        {
          fullName: "Updated Name",
        } as never,
      ),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(state.transactionCalls, 0);
});

test("employees update accepts same-company department and site", async () => {
  const { service, state } = createService({
    existingEmployee: createExistingEmployee(),
  });

  const employee = await service.update(
    adminUser,
    "employee-1",
    {
      departmentId: "department-2",
      siteId: "site-2",
      fullName: "Updated Name",
    } as never,
  );

  assert.equal(state.transactionCalls, 1);
  assert.equal(state.employeeUpdateData?.departmentId, "department-2");
  assert.equal(state.employeeUpdateData?.siteId, "site-2");
  assert.deepEqual(employee, {
    id: "employee-1",
    departmentId: "department-2",
    siteId: "site-2",
  });
});
