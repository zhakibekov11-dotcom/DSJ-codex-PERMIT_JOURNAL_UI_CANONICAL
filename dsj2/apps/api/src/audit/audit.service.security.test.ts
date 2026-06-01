import assert from "node:assert/strict";
import { test } from "node:test";
import { AuditService } from "./audit.service";

test("audit list selects only safe actor fields and caps limit", async () => {
  type FindManyArgs = {
    include?: {
      actorUser?: {
        select?: Record<string, boolean>;
      };
    };
    take?: number;
  };
  let findManyArgs: FindManyArgs | undefined;

  const service = new AuditService({
    auditLog: {
      findMany: async (args: FindManyArgs) => {
        findManyArgs = args;
        return [];
      },
    },
  } as never);

  await service.list("company-1", 500, "Employee");

  assert.equal(findManyArgs!.take, 100);
  assert.deepEqual(findManyArgs!.include?.actorUser?.select, {
    id: true,
    companyId: true,
    email: true,
    fullName: true,
    role: true,
  });
  assert.equal("passwordHash" in findManyArgs!.include!.actorUser!.select!, false);
  assert.equal("iinEncrypted" in findManyArgs!.include!.actorUser!.select!, false);
  assert.equal("iinHash" in findManyArgs!.include!.actorUser!.select!, false);
});
