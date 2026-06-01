import {
  createPrismaClient,
  decryptSensitiveValue,
  hashInviteToken,
  hashSensitiveValue,
} from "@dsj/database";

const prisma = createPrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function backfillEmployeeHashes() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      iinEncrypted: true,
      iinHash: true,
    },
  });

  let updated = 0;

  for (const employee of employees) {
    const iin = decryptSensitiveValue(employee.iinEncrypted);
    const nextHash = hashSensitiveValue(iin);

    if (employee.iinHash === nextHash) {
      continue;
    }

    updated += 1;

    if (!dryRun) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { iinHash: nextHash },
      });
    }
  }

  return { scanned: employees.length, updated };
}

async function backfillContractorWorkerHashes() {
  const workers = await prisma.contractorWorker.findMany({
    select: {
      id: true,
      iinEncrypted: true,
      iinHash: true,
    },
  });

  let updated = 0;

  for (const worker of workers) {
    const iin = decryptSensitiveValue(worker.iinEncrypted);
    const nextHash = hashSensitiveValue(iin);

    if (worker.iinHash === nextHash) {
      continue;
    }

    updated += 1;

    if (!dryRun) {
      await prisma.contractorWorker.update({
        where: { id: worker.id },
        data: { iinHash: nextHash },
      });
    }
  }

  return { scanned: workers.length, updated };
}

async function backfillInviteTokenHashes() {
  const records = await prisma.briefingRecord.findMany({
    where: {
      inviteToken: {
        not: null,
      },
    },
    select: {
      id: true,
      inviteToken: true,
      inviteTokenHash: true,
    },
  });

  let updated = 0;
  let clearedPlaintext = 0;

  for (const record of records) {
    if (!record.inviteToken) {
      continue;
    }

    const nextHash = hashInviteToken(record.inviteToken);
    const needsUpdate = record.inviteTokenHash !== nextHash || record.inviteToken !== null;

    if (!needsUpdate) {
      continue;
    }

    updated += record.inviteTokenHash === nextHash ? 0 : 1;
    clearedPlaintext += 1;

    if (!dryRun) {
      await prisma.briefingRecord.update({
        where: { id: record.id },
        data: {
          inviteTokenHash: nextHash,
          inviteToken: null,
        },
      });
    }
  }

  return { scanned: records.length, updated, clearedPlaintext };
}

async function main() {
  const [employees, contractorWorkers, inviteTokens] = await Promise.all([
    backfillEmployeeHashes(),
    backfillContractorWorkerHashes(),
    backfillInviteTokenHashes(),
  ]);

  console.log(
    JSON.stringify(
      {
        dryRun,
        employees,
        contractorWorkers,
        inviteTokens,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
