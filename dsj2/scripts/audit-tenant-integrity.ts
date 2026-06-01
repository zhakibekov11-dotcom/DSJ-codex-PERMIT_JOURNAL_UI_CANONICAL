import { createPrismaClient } from "@dsj/database";

type Violation = {
  table: string;
  id: string;
  field: string;
  ownerField: "companyId" | "organizationId";
  ownerId: string | null;
  referencedId: string | null;
  referencedOwnerId: string | null;
  message: string;
};

const prisma = createPrismaClient();

function ownerLabel(ownerField: "companyId" | "organizationId", ownerId: string | null) {
  return `${ownerField}=${ownerId ?? "null"}`;
}

async function main() {
  const violations: Violation[] = [];

  const [organizations, departments, sites, workSites] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        legacyCompanyId: true,
      },
    }),
    prisma.department.findMany({
      select: {
        id: true,
        companyId: true,
      },
    }),
    prisma.site.findMany({
      select: {
        id: true,
        companyId: true,
      },
    }),
    prisma.workSite.findMany({
      select: {
        id: true,
        organizationId: true,
      },
    }),
  ]);

  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  const departmentCompanyById = new Map(
    departments.map((department) => [department.id, department.companyId]),
  );
  const siteCompanyById = new Map(sites.map((site) => [site.id, site.companyId]));
  const workSiteOrganizationById = new Map(
    workSites.map((workSite) => [workSite.id, workSite.organizationId]),
  );

  function companyMatchesOwner(companyId: string, ownerId: string) {
    if (companyId === ownerId) {
      return true;
    }

    return organizationById.get(ownerId)?.legacyCompanyId === companyId;
  }

  function organizationMatchesOwner(organizationId: string, ownerId: string) {
    if (organizationId === ownerId) {
      return true;
    }

    return (
      organizationById.get(organizationId)?.legacyCompanyId === ownerId ||
      organizationById.get(ownerId)?.legacyCompanyId === organizationId
    );
  }

  function departmentMatchesOwner(departmentId: string, ownerId: string) {
    const departmentCompanyId = departmentCompanyById.get(departmentId);

    return departmentCompanyId
      ? companyMatchesOwner(departmentCompanyId, ownerId)
      : false;
  }

  function siteMatchesOwner(siteId: string, ownerId: string) {
    const siteCompanyId = siteCompanyById.get(siteId);

    return siteCompanyId ? companyMatchesOwner(siteCompanyId, ownerId) : false;
  }

  function workSiteMatchesOwner(workSiteId: string, ownerId: string) {
    const workSiteOrganizationId = workSiteOrganizationById.get(workSiteId);

    if (workSiteOrganizationId) {
      return organizationMatchesOwner(workSiteOrganizationId, ownerId);
    }

    return siteMatchesOwner(workSiteId, ownerId);
  }

  function addViolation(args: Omit<Violation, "message">) {
    violations.push({
      ...args,
      message: `${args.table}.${args.field} points outside ${ownerLabel(
        args.ownerField,
        args.ownerId,
      )}`,
    });
  }

  function checkDepartment(args: {
    table: string;
    id: string;
    ownerField: "companyId" | "organizationId";
    ownerId: string;
    departmentId: string | null;
  }) {
    if (!args.departmentId || departmentMatchesOwner(args.departmentId, args.ownerId)) {
      return;
    }

    addViolation({
      table: args.table,
      id: args.id,
      field: "departmentId",
      ownerField: args.ownerField,
      ownerId: args.ownerId,
      referencedId: args.departmentId,
      referencedOwnerId: departmentCompanyById.get(args.departmentId) ?? null,
    });
  }

  function checkSite(args: {
    table: string;
    id: string;
    ownerId: string;
    siteId: string | null;
  }) {
    if (!args.siteId || siteMatchesOwner(args.siteId, args.ownerId)) {
      return;
    }

    addViolation({
      table: args.table,
      id: args.id,
      field: "siteId",
      ownerField: "companyId",
      ownerId: args.ownerId,
      referencedId: args.siteId,
      referencedOwnerId: siteCompanyById.get(args.siteId) ?? null,
    });
  }

  function checkWorkSite(args: {
    table: string;
    id: string;
    ownerId: string;
    workSiteId: string | null;
  }) {
    if (!args.workSiteId || workSiteMatchesOwner(args.workSiteId, args.ownerId)) {
      return;
    }

    addViolation({
      table: args.table,
      id: args.id,
      field: "workSiteId",
      ownerField: "organizationId",
      ownerId: args.ownerId,
      referencedId: args.workSiteId,
      referencedOwnerId:
        workSiteOrganizationById.get(args.workSiteId) ??
        siteCompanyById.get(args.workSiteId) ??
        null,
    });
  }

  const [employees, users, briefingRecords] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        companyId: true,
        departmentId: true,
        siteId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: {
          not: null,
        },
      },
      select: {
        id: true,
        companyId: true,
        departmentId: true,
        siteId: true,
      },
    }),
    prisma.briefingRecord.findMany({
      select: {
        id: true,
        companyId: true,
        departmentId: true,
        siteId: true,
      },
    }),
  ]);

  for (const employee of employees) {
    checkDepartment({
      table: "Employee",
      id: employee.id,
      ownerField: "companyId",
      ownerId: employee.companyId,
      departmentId: employee.departmentId,
    });
    checkSite({
      table: "Employee",
      id: employee.id,
      ownerId: employee.companyId,
      siteId: employee.siteId,
    });
  }

  for (const user of users) {
    if (!user.companyId) {
      continue;
    }

    checkDepartment({
      table: "User",
      id: user.id,
      ownerField: "companyId",
      ownerId: user.companyId,
      departmentId: user.departmentId,
    });
    checkSite({
      table: "User",
      id: user.id,
      ownerId: user.companyId,
      siteId: user.siteId,
    });
  }

  for (const record of briefingRecords) {
    checkDepartment({
      table: "BriefingRecord",
      id: record.id,
      ownerField: "companyId",
      ownerId: record.companyId,
      departmentId: record.departmentId,
    });
    checkSite({
      table: "BriefingRecord",
      id: record.id,
      ownerId: record.companyId,
      siteId: record.siteId,
    });
  }

  const [
    briefingJournals,
    briefingJournalEntries,
    workPermits,
    protocols,
    responsibilityOrders,
    responsibilityAppointments,
    admissionEvaluations,
  ] = await Promise.all([
    prisma.briefingJournal.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.briefingJournalEntry.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.workPermit.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.protocol.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.responsibilityOrder.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.responsibilityAppointment.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
    prisma.admissionEvaluation.findMany({
      select: {
        id: true,
        organizationId: true,
        departmentId: true,
        workSiteId: true,
      },
    }),
  ]);

  for (const record of [
    ...briefingJournals.map((item) => ({
      table: "BriefingJournal",
      ...item,
    })),
    ...briefingJournalEntries.map((item) => ({
      table: "BriefingJournalEntry",
      ...item,
    })),
    ...workPermits.map((item) => ({
      table: "WorkPermit",
      ...item,
    })),
    ...protocols.map((item) => ({
      table: "Protocol",
      ...item,
    })),
    ...responsibilityOrders.map((item) => ({
      table: "ResponsibilityOrder",
      ...item,
    })),
    ...responsibilityAppointments.map((item) => ({
      table: "ResponsibilityAppointment",
      ...item,
    })),
    ...admissionEvaluations.map((item) => ({
      table: "AdmissionEvaluation",
      ...item,
    })),
  ]) {
    checkDepartment({
      table: record.table,
      id: record.id,
      ownerField: "organizationId",
      ownerId: record.organizationId,
      departmentId: record.departmentId,
    });
    checkWorkSite({
      table: record.table,
      id: record.id,
      ownerId: record.organizationId,
      workSiteId: record.workSiteId,
    });
  }

  const summary = {
    violations: violations.length,
    byTable: violations.reduce<Record<string, number>>((accumulator, violation) => {
      accumulator[violation.table] = (accumulator[violation.table] ?? 0) + 1;
      return accumulator;
    }, {}),
  };

  console.log(JSON.stringify({ summary, violations }, null, 2));

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
