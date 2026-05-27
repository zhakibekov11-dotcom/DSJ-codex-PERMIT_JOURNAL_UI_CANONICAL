import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { encryptSensitiveValue } from "@dsj/database";
import {
  publicBriefingInviteSchema,
  publicSignBriefingSchema,
} from "@dsj/types";
import { SignaturesService } from "./signatures.service";

const TEST_DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_IIN = "980317350011";

process.env.FIELD_ENCRYPTION_KEY = "signatures-service-wave1-test-key";

function createInviteRecord() {
  return {
    id: "record-1",
    companyId: "company-1",
    employeeId: "employee-1",
    employeeStatus: "ASSIGNED",
    status: "READY_FOR_SIGNING",
    documentNumber: "AIS-BR-0002",
    briefingType: "INTRODUCTORY",
    briefingDate: new Date("2026-03-20T00:00:00.000Z"),
    topic: "Introductory briefing",
    notes: "Bring PPE",
    inviteToken: "invite-token",
    inviteTokenExpiresAt: new Date("2026-04-20T00:00:00.000Z"),
    inviteSentAt: new Date("2026-03-21T00:00:00.000Z"),
    registrationCompletedAt: null,
    signedAt: null,
    openedAt: null,
    acknowledgedAt: null,
    documentHash: TEST_DIGEST,
    employee: {
      id: "employee-1",
      fullName: "Aigerim Sadykova",
      employeeNumber: "EMP-001",
      jobTitle: "Safety Engineer",
      email: "aigerim@example.com",
      phone: "+77015550011",
      employeeKind: "INTERNAL",
      contractorCompany: null,
      iinEncrypted: encryptSensitiveValue(TEST_IIN),
      iinHash: "hash",
      iinLast4: "0011",
      userId: "user-employee-1",
    },
    instructor: {
      id: "user-instructor-1",
      fullName: "Marat Kairatuly",
    },
    department: {
      id: "department-1",
      name: "HSE",
    },
    site: {
      id: "site-1",
      name: "West Pad",
    },
    signatures: [
      {
        id: "signature-1",
        certificateSerial: "CERT-123456",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
        payload: {
          provider: "MOCK_NCALAYER",
        },
      },
    ],
  };
}

function createNcalayerPayload(overrides: Record<string, string> = {}) {
  return {
    signingDigest: overrides.signingDigest ?? TEST_DIGEST,
    signedAt: overrides.signedAt ?? "2026-03-22T10:00:00.000Z",
    signerName: overrides.signerName ?? "Aigerim Sadykova",
    signerIin: overrides.signerIin ?? "980317350011",
    certificateSerial: overrides.certificateSerial ?? "CERT-123456",
    certificateThumbprint: overrides.certificateThumbprint ?? "thumbprint-1",
    certificateSubject: overrides.certificateSubject ?? "CN=Aigerim Sadykova",
    certificateIssuer: overrides.certificateIssuer ?? "CN=NCALayer CA",
    certificateValidFrom: overrides.certificateValidFrom ?? "2026-03-01T00:00:00.000Z",
    certificateValidTo: overrides.certificateValidTo ?? "2027-03-01T00:00:00.000Z",
    cms: overrides.cms ?? "cms-payload",
    bridgeVersion: overrides.bridgeVersion ?? "1.0.0",
    bridgeUrl: overrides.bridgeUrl ?? "http://127.0.0.1:13579",
  };
}

function createService(config: Record<string, string | undefined>) {
  const state = {
    briefingRecordUpdateCalls: 0,
    employeeUpdateCalls: 0,
    findUniqueCalls: 0,
    signatureCreateCalls: 0,
  };
  const record = createInviteRecord();
  const signedAt = new Date("2026-03-22T10:00:00.000Z");

  const prisma = {
    briefingRecord: {
      findUnique: async () => {
        state.findUniqueCalls += 1;
        return record;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.briefingRecordUpdateCalls += 1;
        record.status = (data.status as typeof record.status | undefined) ?? record.status;
        record.employeeStatus =
          (data.employeeStatus as typeof record.employeeStatus | undefined) ??
          record.employeeStatus;
        record.openedAt =
          (data.openedAt as typeof record.openedAt | undefined) ?? record.openedAt;
        record.acknowledgedAt =
          (data.acknowledgedAt as typeof record.acknowledgedAt | undefined) ??
          record.acknowledgedAt;
        record.signedAt =
          (data.signedAt as typeof record.signedAt | undefined) ?? record.signedAt;
        record.registrationCompletedAt =
          (data.registrationCompletedAt as typeof record.registrationCompletedAt | undefined) ??
          record.registrationCompletedAt;
        record.documentHash =
          (data.documentHash as typeof record.documentHash | undefined) ?? record.documentHash;

        return {
          id: record.id,
          status: record.status,
          employeeStatus: record.employeeStatus,
          signedAt: record.signedAt,
        };
      },
    },
    employee: {
      update: async () => {
        state.employeeUpdateCalls += 1;
        return null;
      },
    },
    signature: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.signatureCreateCalls += 1;
        return {
          id: "signature-1",
          provider: data.provider as string,
          status: data.status as string,
          signerName: data.signerName as string,
          signerIinMasked: data.signerIinMasked as string,
          certificateSerial: data.certificateSerial as string,
          documentHash: data.documentHash as string,
          signedAt,
          payload: data.payload,
        };
      },
    },
  };

  const service = new SignaturesService(
    prisma as never,
    {
      log: async () => undefined,
    } as never,
    {
      resolveBriefingReminders: async () => undefined,
    } as never,
    {
      sign: (input: {
        briefingRecordId: string;
        certificateSerial: string;
        documentHash: string | null;
        signerName: string;
      }) => ({
        provider: "MOCK_NCALAYER",
        status: "SIGNED",
        signerName: input.signerName,
        signerIin: TEST_IIN,
        signerIinMasked: "9803********",
        certificateSerial: input.certificateSerial,
        documentHash: input.documentHash ?? `hash-${input.briefingRecordId}`,
        signedAt,
        payload: {
          provider: "MOCK_NCALAYER",
        },
      }),
    } as never,
    {
      sign: (input: {
        briefingRecordId: string;
        certificateSerial: string;
        documentHash: string | null;
        signerName: string;
        signerIin: string;
        signingDigest: string;
        signedAt: string;
        certificateThumbprint: string;
        certificateSubject: string;
        certificateIssuer: string;
        certificateValidFrom: string;
        certificateValidTo: string;
        cms: string;
      }) => {
        if (input.documentHash !== input.signingDigest) {
          throw new BadRequestException("NCALayer signing digest does not match the record.");
        }

        return {
          provider: "NCALAYER",
          status: "SIGNED",
          signerName: input.signerName,
          signerIin: input.signerIin,
          signerIinMasked: "980317******",
          certificateSerial: input.certificateSerial,
          documentHash: input.documentHash ?? `hash-${input.briefingRecordId}`,
          signedAt,
          payload: {
            provider: "NCALAYER",
            signingDigest: input.signingDigest,
            cms: input.cms,
            certificateSerial: input.certificateSerial,
          },
        };
      },
    } as never,
    {
      get: (key: string) => config[key],
    } as never,
  );

  return {
    service,
    signedAt,
    state,
  };
}

test("public invite response stays on the narrowed public DTO", async () => {
  const { service } = createService({
    SIGNING_PROVIDER: "MOCK_NCALAYER",
    NODE_ENV: "production",
    ALLOW_PUBLIC_INVITE_MOCK_SIGNING: "true",
  });

  const invite = await service.getPublicInvite("invite-token");
  const parsedInvite = publicBriefingInviteSchema.parse(invite);

  assert.deepEqual(Object.keys(parsedInvite).sort(), [
    "briefingDate",
    "briefingType",
    "department",
    "documentNumber",
    "employee",
    "instructor",
    "inviteTokenExpiresAt",
    "notes",
    "publicMockSignEnabled",
    "signedAt",
    "signingAvailable",
    "signingDigest",
    "status",
    "topic",
  ].sort());
  assert.equal("companyId" in parsedInvite, false);
  assert.equal("inviteSentAt" in parsedInvite, false);
  assert.equal("registrationCompletedAt" in parsedInvite, false);
  assert.equal("signatures" in parsedInvite, false);
  assert.equal("site" in parsedInvite, false);
  assert.equal("certificateSerial" in parsedInvite.employee, false);
  assert.equal("email" in parsedInvite.employee, false);
  assert.equal("iinEncrypted" in parsedInvite.employee, false);
  assert.equal("phone" in parsedInvite.employee, false);
  assert.equal(parsedInvite.signingDigest, TEST_DIGEST);
  assert.equal(parsedInvite.publicMockSignEnabled, false);
  assert.equal(parsedInvite.signingAvailable, false);
});

test("public sign schema strips legacy contact fields", () => {
  const parsedInput = publicSignBriefingSchema.parse({
    signerName: "Aigerim Sadykova",
    signerIin: "980317350011",
    certificateSerial: "CERT-123456",
    email: "aigerim@example.com",
    phone: "+77015550011",
  });

  assert.deepEqual(parsedInput, {
    signerName: "Aigerim Sadykova",
    signerIin: "980317350011",
    certificateSerial: "CERT-123456",
  });
  assert.equal("email" in parsedInput, false);
  assert.equal("phone" in parsedInput, false);
});

test("public sign schema accepts NCALayer bridge payloads", () => {
  const parsedInput = publicSignBriefingSchema.parse({
    signingDigest: TEST_DIGEST,
    signedAt: "2026-03-22T10:00:00.000Z",
    signerName: "Aigerim Sadykova",
    signerIin: "980317350011",
    certificateSerial: "CERT-123456",
    certificateThumbprint: "thumbprint-1",
    certificateSubject: "CN=Aigerim Sadykova",
    certificateIssuer: "CN=NCALayer CA",
    certificateValidFrom: "2026-03-01T00:00:00.000Z",
    certificateValidTo: "2027-03-01T00:00:00.000Z",
    cms: "cms-payload",
    bridgeVersion: "1.0.0",
    bridgeUrl: "http://127.0.0.1:13579",
    email: "aigerim@example.com",
    phone: "+77015550011",
  });

  assert.deepEqual(parsedInput, {
    signingDigest: TEST_DIGEST,
    signedAt: "2026-03-22T10:00:00.000Z",
    signerName: "Aigerim Sadykova",
    signerIin: "980317350011",
    certificateSerial: "CERT-123456",
    certificateThumbprint: "thumbprint-1",
    certificateSubject: "CN=Aigerim Sadykova",
    certificateIssuer: "CN=NCALayer CA",
    certificateValidFrom: "2026-03-01T00:00:00.000Z",
    certificateValidTo: "2027-03-01T00:00:00.000Z",
    cms: "cms-payload",
    bridgeVersion: "1.0.0",
    bridgeUrl: "http://127.0.0.1:13579",
  });
  assert.equal("email" in parsedInput, false);
  assert.equal("phone" in parsedInput, false);
});

test("mock signing in NCALayer mode rejects malformed bridge payloads", async () => {
  const { service, state } = createService({
    SIGNING_PROVIDER: "NCALAYER",
    NCALAYER_BRIDGE_URL: "http://127.0.0.1:13580",
  });

  await assert.rejects(
    () =>
      service.mockSign(
        {
          userId: "user-admin-1",
          role: "COMPANY_ADMIN",
          companyId: "company-1",
          fullName: "Admin User",
        } as never,
        "record-1",
        {
          signerName: "Aigerim Sadykova",
          signerIin: TEST_IIN,
          certificateSerial: "CERT-123456",
        } as never,
      ),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(state.signatureCreateCalls, 0);
  assert.equal(state.briefingRecordUpdateCalls, 0);
});

test("mock signing in NCALayer mode rejects digest mismatches", async () => {
  const { service, state } = createService({
    SIGNING_PROVIDER: "NCALAYER",
    NCALAYER_BRIDGE_URL: "http://127.0.0.1:13580",
  });

  await assert.rejects(
    () =>
      service.mockSign(
        {
          userId: "user-admin-1",
          role: "COMPANY_ADMIN",
          companyId: "company-1",
          fullName: "Admin User",
        } as never,
        "record-1",
        createNcalayerPayload({ signingDigest: "hash-mismatch" }) as never,
      ),
    (error) => error instanceof BadRequestException,
  );

  assert.equal(state.signatureCreateCalls, 0);
  assert.equal(state.briefingRecordUpdateCalls, 0);
});

test("mock signing in NCALayer mode stores the NCALayer provider payload", async () => {
  const { service, state } = createService({
    SIGNING_PROVIDER: "NCALAYER",
    NCALAYER_BRIDGE_URL: "http://127.0.0.1:13580",
  });

  const signature = await service.mockSign(
    {
      userId: "user-admin-1",
      role: "COMPANY_ADMIN",
      companyId: "company-1",
      fullName: "Admin User",
    } as never,
    "record-1",
    createNcalayerPayload() as never,
  );

  assert.equal(signature.provider, "NCALAYER");
  assert.equal((signature.payload as { provider?: string }).provider, "NCALAYER");
  assert.equal(state.signatureCreateCalls, 1);
  assert.equal(state.briefingRecordUpdateCalls, 1);
});

test("public mock signing stays disabled by default and in production", () => {
  const disabledByDefault = createService({}).service as any;
  const disabledInProduction = createService({
    NODE_ENV: "production",
    ALLOW_PUBLIC_INVITE_MOCK_SIGNING: "true",
  }).service as any;
  const enabledOnlyWhenExplicit = createService({
    NODE_ENV: "development",
    ALLOW_PUBLIC_INVITE_MOCK_SIGNING: "true",
  }).service as any;

  assert.equal(disabledByDefault.isPublicMockSigningEnabled(), false);
  assert.equal(disabledInProduction.isPublicMockSigningEnabled(), false);
  assert.equal(enabledOnlyWhenExplicit.isPublicMockSigningEnabled(), true);
});

test("public mock signing rejects before any record read when the gate is closed", async () => {
  const { service, state } = createService({
    SIGNING_PROVIDER: "MOCK_NCALAYER",
    NODE_ENV: "development",
  });

  await assert.rejects(
    () =>
      service.publicMockSign("invite-token", {
        signerName: "Aigerim Sadykova",
        signerIin: "980317350011",
        certificateSerial: "CERT-123456",
      }),
    (error) => error instanceof ForbiddenException,
  );

  assert.equal(state.findUniqueCalls, 0);
  assert.equal(state.employeeUpdateCalls, 0);
  assert.equal(state.signatureCreateCalls, 0);
});

test("public mock signing never mutates employee master data", async () => {
  const { service, signedAt, state } = createService({
    SIGNING_PROVIDER: "MOCK_NCALAYER",
    NODE_ENV: "development",
    ALLOW_PUBLIC_INVITE_MOCK_SIGNING: "true",
  });

  const invite = await service.publicMockSign("invite-token", {
    signerName: "Aigerim Sadykova",
    signerIin: "980317350011",
    certificateSerial: "CERT-123456",
    email: "replacement@example.com",
    phone: "+77017770000",
  } as never);
  const parsedInvite = publicBriefingInviteSchema.parse(invite);

  assert.equal(parsedInvite.status, "SIGNED");
  assert.equal(parsedInvite.signedAt, signedAt.toISOString());
  assert.equal("email" in parsedInvite.employee, false);
  assert.equal("phone" in parsedInvite.employee, false);
  assert.equal(state.employeeUpdateCalls, 0);
  assert.equal(state.signatureCreateCalls, 1);
  assert.equal(state.briefingRecordUpdateCalls, 1);
});
