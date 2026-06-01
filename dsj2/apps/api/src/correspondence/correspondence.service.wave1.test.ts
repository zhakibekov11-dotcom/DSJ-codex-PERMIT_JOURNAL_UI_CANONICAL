import assert from "node:assert/strict";
import { test } from "node:test";
import { CorrespondenceService } from "./correspondence.service";

function createRecord() {
  return {
    id: "correspondence-1",
    companyId: "company-1",
    createdByUserId: "user-1",
    registryNumber: "OUT/26-00001",
    title: "Offer",
    kind: "LETTER",
    subject: "Commercial offer",
    body: "Body",
    status: "READY_TO_SEND",
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    sentAt: null,
    company: {
      name: "Stroy Company 2030",
    },
    createdByUser: {
      fullName: "Aigerim Sadykova",
    },
    recipients: [
      {
        id: "recipient-email",
        companyName: "Orken",
        contactName: "Dana",
        contactEmail: "dana@example.com",
        contactPosition: "Procurement Lead",
        status: "PENDING",
        sentAt: null,
        lastError: null,
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
      },
      {
        id: "recipient-no-email",
        companyName: "No Email LLP",
        contactName: "Asset",
        contactEmail: null,
        contactPosition: null,
        status: "PENDING",
        sentAt: null,
        lastError: null,
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
      },
    ],
  };
}

test("send does not mark correspondence as sent without an email transport", async () => {
  const recipientUpdates: Array<{
    where: { id: string };
    data: Record<string, unknown>;
  }> = [];
  const correspondenceUpdates: Array<{
    where: { id: string };
    data: Record<string, unknown>;
  }> = [];
  const auditLogs: Array<{
    action: string;
    metadata: Record<string, unknown>;
  }> = [];

  const record = createRecord();
  const prisma = {
    correspondence: {
      findUnique: async () => record,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        correspondenceUpdates.push(args);
        return record;
      },
    },
    correspondenceRecipient: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        recipientUpdates.push(args);
        return {};
      },
    },
    $transaction: async <T>(callback: (transaction: any) => Promise<T>) =>
      callback({
        correspondence: prisma.correspondence,
        correspondenceRecipient: prisma.correspondenceRecipient,
      }),
  };
  const service = new CorrespondenceService(
    prisma as never,
    {
      log: async (entry: { action: string; metadata: Record<string, unknown> }) => {
        auditLogs.push(entry);
      },
    } as never,
    {} as never,
    {} as never,
  );

  await service.send(
    {
      userId: "user-1",
      companyId: "company-1",
      email: "admin@example.com",
      fullName: "Admin",
      role: "COMPANY_ADMIN",
    },
    "correspondence-1",
  );

  assert.deepEqual(correspondenceUpdates[0]?.data, {
    status: "READY_TO_SEND",
    sentAt: null,
  });

  assert.deepEqual(recipientUpdates[0]?.data, {
    status: "PENDING",
    sentAt: null,
    lastError:
      "Email transport is not configured; correspondence was not sent externally.",
  });
  assert.equal(recipientUpdates[1]?.data.status, "FAILED");
  assert.equal(auditLogs[0]?.action, "correspondence.delivery_deferred");
  assert.deepEqual(auditLogs[0]?.metadata, {
    sentCount: 0,
    failedCount: 1,
    deferredCount: 1,
    transportConfigured: false,
  });
});
