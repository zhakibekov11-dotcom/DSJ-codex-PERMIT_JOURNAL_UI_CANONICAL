import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createPrismaClient } from "../src/client";
import { encryptSensitiveValue, hashSensitiveValue } from "../src/security";

const prisma = createPrismaClient();

const organizationId = "permit-demo-company";
const demoUserEmail =
  process.env.PERMIT_DEMO_USER_EMAIL?.trim() || "permit.demo@dsj.local";

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes"].includes(value?.trim().toLowerCase() ?? "");
}

function isLocalDatabaseUrl(databaseUrl: string) {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

function assertDemoFixtureGuards() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required before running the permit demo fixture.",
    );
  }
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("Refusing to run the permit demo fixture in production.");
  }
  if (!isTruthy(process.env.PERMIT_DEMO_SEED_ENABLED)) {
    throw new Error("Refusing to run without PERMIT_DEMO_SEED_ENABLED=true.");
  }
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(
      "Refusing to run the permit demo fixture against a non-local DATABASE_URL.",
    );
  }
  if (!process.env.PERMIT_DEMO_USER_PASSWORD?.trim()) {
    throw new Error("PERMIT_DEMO_USER_PASSWORD is required.");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

async function upsertEmployee(input: {
  id: string;
  employeeNumber: string;
  fullName: string;
  jobTitle: string;
  departmentId: string;
  siteId: string;
  userId?: string;
  syntheticIin: string;
}) {
  return prisma.employee.upsert({
    where: {
      companyId_employeeNumber: {
        companyId: organizationId,
        employeeNumber: input.employeeNumber,
      },
    },
    update: {
      fullName: input.fullName,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId,
      siteId: input.siteId,
      userId: input.userId ?? null,
      status: "active",
      isArchived: false,
    },
    create: {
      id: input.id,
      companyId: organizationId,
      departmentId: input.departmentId,
      siteId: input.siteId,
      userId: input.userId ?? null,
      fullName: input.fullName,
      iinEncrypted: encryptSensitiveValue(input.syntheticIin),
      iinHash: hashSensitiveValue(input.syntheticIin),
      iinLast4: input.syntheticIin.slice(-4),
      employeeNumber: input.employeeNumber,
      jobTitle: input.jobTitle,
      employeeKind: "INTERNAL",
      status: "active",
    },
  });
}

async function upsertQualification(input: {
  documentNumber: string;
  documentKind: "CERTIFICATE" | "MEDICAL_CLEARANCE";
  employeeId?: string;
  contractorWorkerId?: string;
  issueDate: Date;
  expiryDate: Date;
}) {
  return prisma.qualificationDocument.upsert({
    where: {
      organizationId_documentNumber: {
        organizationId,
        documentNumber: input.documentNumber,
      },
    },
    update: {
      employeeId: input.employeeId ?? null,
      contractorWorkerId: input.contractorWorkerId ?? null,
      documentKind: input.documentKind,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      status: "ACTIVE",
    },
    create: {
      organizationId,
      employeeId: input.employeeId ?? null,
      contractorWorkerId: input.contractorWorkerId ?? null,
      documentKind: input.documentKind,
      documentNumber: input.documentNumber,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      status: "ACTIVE",
    },
  });
}

async function ensurePpe(input: {
  employeeId?: string;
  contractorWorkerId?: string;
  itemCode: string;
  itemName: string;
  issuedAt: Date;
  validUntil: Date;
  createdByUserId: string;
}) {
  const existing = await prisma.ppeIssueRecord.findFirst({
    where: {
      organizationId,
      employeeId: input.employeeId ?? null,
      contractorWorkerId: input.contractorWorkerId ?? null,
      itemCode: input.itemCode,
    },
  });
  const source = {
    employeeId: input.employeeId ?? null,
    contractorWorkerId: input.contractorWorkerId ?? null,
    itemCode: input.itemCode,
    itemName: input.itemName,
    issuedAt: input.issuedAt.toISOString(),
    validUntil: input.validUntil.toISOString(),
  };
  const data = {
    organizationId,
    employeeId: input.employeeId ?? null,
    contractorWorkerId: input.contractorWorkerId ?? null,
    itemCode: input.itemCode,
    itemName: input.itemName,
    status: "ACTIVE" as const,
    issuedAt: input.issuedAt,
    validUntil: input.validUntil,
    sourceHash: canonicalHash(source),
    createdByUserId: input.createdByUserId,
  };
  return existing
    ? prisma.ppeIssueRecord.update({ where: { id: existing.id }, data })
    : prisma.ppeIssueRecord.create({ data });
}

async function main() {
  assertDemoFixtureGuards();

  const passwordHash = await hash(
    process.env.PERMIT_DEMO_USER_PASSWORD!.trim(),
    12,
  );
  const now = new Date();
  const issueDate = new Date(now);
  issueDate.setDate(issueDate.getDate() - 30);
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const actValidFrom = new Date(now);
  actValidFrom.setDate(actValidFrom.getDate() - 1);
  const actValidTo = new Date(now);
  actValidTo.setDate(actValidTo.getDate() + 30);

  await prisma.company.upsert({
    where: { id: organizationId },
    update: {
      name: "DSJ Permit Demo LLP",
      industry: "Synthetic customer demo data",
      timezone: "Asia/Almaty",
      isActive: true,
    },
    create: {
      id: organizationId,
      name: "DSJ Permit Demo LLP",
      bin: "000000000000",
      industry: "Synthetic customer demo data",
      timezone: "Asia/Almaty",
    },
  });
  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {
      name: "DSJ Permit Demo LLP",
      timezone: "Asia/Almaty",
      isActive: true,
    },
    create: {
      id: organizationId,
      legacyCompanyId: organizationId,
      code: "PERMIT-DEMO",
      name: "DSJ Permit Demo LLP",
      bin: "000000000000",
      timezone: "Asia/Almaty",
    },
  });

  const department = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: organizationId,
        name: "Permit Demo Operations",
      },
    },
    update: { code: "PDM" },
    create: {
      companyId: organizationId,
      name: "Permit Demo Operations",
      code: "PDM",
    },
  });
  const site = await prisma.site.upsert({
    where: {
      companyId_name: {
        companyId: organizationId,
        name: "Permit Demo Workshop",
      },
    },
    update: { location: "Almaty demo site", isActive: true },
    create: {
      companyId: organizationId,
      name: "Permit Demo Workshop",
      location: "Almaty demo site",
    },
  });
  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: { organizationId, code: "PDM-BRANCH" },
    },
    update: { name: "Permit Demo Branch", isActive: true },
    create: {
      organizationId,
      code: "PDM-BRANCH",
      name: "Permit Demo Branch",
    },
  });
  const workSite = await prisma.workSite.upsert({
    where: {
      organizationId_code: { organizationId, code: "PDM-WORKSHOP" },
    },
    update: {
      branchId: branch.id,
      name: "Permit Demo Workshop",
      location: "Maintenance bay A",
      isActive: true,
    },
    create: {
      organizationId,
      branchId: branch.id,
      code: "PDM-WORKSHOP",
      name: "Permit Demo Workshop",
      location: "Maintenance bay A",
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: {
      companyId: organizationId,
      departmentId: department.id,
      siteId: site.id,
      passwordHash,
      fullName: "Permit Demo Safety Engineer",
      role: "SAFETY_ENGINEER",
      isActive: true,
    },
    create: {
      companyId: organizationId,
      departmentId: department.id,
      siteId: site.id,
      email: demoUserEmail,
      passwordHash,
      fullName: "Permit Demo Safety Engineer",
      role: "SAFETY_ENGINEER",
      isActive: true,
    },
  });

  const actor = await upsertEmployee({
    id: "permit-demo-employee-actor",
    employeeNumber: "PDM-001",
    fullName: "Permit Demo Safety Engineer",
    jobTitle: "Safety engineer and demo workflow actor",
    departmentId: department.id,
    siteId: site.id,
    userId: demoUser.id,
    syntheticIin: "DEMO-IIN-0001",
  });
  const manager = await upsertEmployee({
    id: "permit-demo-employee-manager",
    employeeNumber: "PDM-002",
    fullName: "Permit Demo Responsible Manager",
    jobTitle: "Responsible manager",
    departmentId: department.id,
    siteId: site.id,
    syntheticIin: "DEMO-IIN-0002",
  });
  const observer = await upsertEmployee({
    id: "permit-demo-employee-observer",
    employeeNumber: "PDM-003",
    fullName: "Permit Demo Observer",
    jobTitle: "Work observer",
    departmentId: department.id,
    siteId: site.id,
    syntheticIin: "DEMO-IIN-0003",
  });
  const crewMember = await upsertEmployee({
    id: "permit-demo-employee-crew",
    employeeNumber: "PDM-004",
    fullName: "Permit Demo Brigade Member",
    jobTitle: "Maintenance technician",
    departmentId: department.id,
    siteId: site.id,
    syntheticIin: "DEMO-IIN-0004",
  });

  const contractor = await prisma.contractorOrganization.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "PDM-CONTRACTOR",
      },
    },
    update: {
      name: "Permit Demo Contractor LLP",
      isActive: true,
      notes: "Synthetic contractor for the permit end-to-end demo.",
    },
    create: {
      organizationId,
      code: "PDM-CONTRACTOR",
      name: "Permit Demo Contractor LLP",
      bin: "000000000001",
      notes: "Synthetic contractor for the permit end-to-end demo.",
      isActive: true,
    },
  });
  const representative = await prisma.contractorWorker.upsert({
    where: {
      organizationId_workerNumber: {
        organizationId,
        workerNumber: "PDM-CW-001",
      },
    },
    update: {
      contractorOrganizationId: contractor.id,
      fullName: "Permit Demo Contractor Representative",
      positionTitle: "Contractor HSE representative",
      status: "active",
      isArchived: false,
    },
    create: {
      id: "permit-demo-contractor-representative",
      organizationId,
      contractorOrganizationId: contractor.id,
      fullName: "Permit Demo Contractor Representative",
      iinEncrypted: encryptSensitiveValue("DEMO-CW-IIN-0001"),
      iinHash: hashSensitiveValue("DEMO-CW-IIN-0001"),
      iinLast4: "0001",
      workerNumber: "PDM-CW-001",
      positionTitle: "Contractor HSE representative",
      status: "active",
    },
  });
  const contractorCrew = await prisma.contractorWorker.upsert({
    where: {
      organizationId_workerNumber: {
        organizationId,
        workerNumber: "PDM-CW-002",
      },
    },
    update: {
      contractorOrganizationId: contractor.id,
      fullName: "Permit Demo Contractor Brigade Member",
      positionTitle: "Contractor maintenance technician",
      status: "active",
      isArchived: false,
    },
    create: {
      id: "permit-demo-contractor-crew",
      organizationId,
      contractorOrganizationId: contractor.id,
      fullName: "Permit Demo Contractor Brigade Member",
      iinEncrypted: encryptSensitiveValue("DEMO-CW-IIN-0002"),
      iinHash: hashSensitiveValue("DEMO-CW-IIN-0002"),
      iinLast4: "0002",
      workerNumber: "PDM-CW-002",
      positionTitle: "Contractor maintenance technician",
      status: "active",
    },
  });

  const trainingProgram = await prisma.trainingProgram.upsert({
    where: {
      companyId_title: {
        companyId: organizationId,
        title: "Permit demo general high-risk work training",
      },
    },
    update: { isActive: true },
    create: {
      companyId: organizationId,
      title: "Permit demo general high-risk work training",
      description: "Synthetic completed training for permit precheck.",
      issuerName: "DSJ Permit Demo Training Center",
      requiresExam: false,
      isActive: true,
    },
  });
  for (const employee of [actor, manager, observer, crewMember]) {
    await prisma.trainingAssignment.upsert({
      where: {
        employeeId_trainingProgramId: {
          employeeId: employee.id,
          trainingProgramId: trainingProgram.id,
        },
      },
      update: {
        status: "COMPLETED",
        progressPercent: 100,
        completedAt: issueDate,
      },
      create: {
        companyId: organizationId,
        employeeId: employee.id,
        trainingProgramId: trainingProgram.id,
        assignedByUserId: demoUser.id,
        status: "COMPLETED",
        progressPercent: 100,
        startedAt: issueDate,
        completedAt: issueDate,
      },
    });
  }

  const briefingJournal = await prisma.briefingJournal.upsert({
    where: {
      organizationId_journalCode: {
        organizationId,
        journalCode: "PDM-TARGET-BRIEFING",
      },
    },
    update: {
      title: "Permit demo targeted briefings",
      workSiteId: workSite.id,
      status: "ACTIVE",
    },
    create: {
      organizationId,
      journalCode: "PDM-TARGET-BRIEFING",
      title: "Permit demo targeted briefings",
      scopeType: "WORK_SITE",
      workSiteId: workSite.id,
      status: "ACTIVE",
      effectiveFrom: issueDate,
    },
  });
  let entryNo = 1;
  for (const employee of [actor, manager, observer, crewMember]) {
    await prisma.briefingJournalEntry.upsert({
      where: {
        organizationId_registrationNo: {
          organizationId,
          registrationNo: `PDM-BR-${employee.employeeNumber}`,
        },
      },
      update: {
        employeeId: employee.id,
        instructorUserId: demoUser.id,
        status: "SIGNED",
        employeeStatus: "SIGNED",
        briefingDate: issueDate,
        signedAt: issueDate,
      },
      create: {
        organizationId,
        journalId: briefingJournal.id,
        entryNo,
        registrationNo: `PDM-BR-${employee.employeeNumber}`,
        journalKind: "WORKPLACE",
        employeeId: employee.id,
        instructorUserId: demoUser.id,
        departmentId: department.id,
        workSiteId: workSite.id,
        briefingType: "TARGETED",
        status: "SIGNED",
        employeeStatus: "SIGNED",
        briefingDate: issueDate,
        topic: "Permit demo hazards, controls, and emergency actions",
        program: "Order No. 344 general high-risk permit demo briefing",
        openedAt: issueDate,
        acknowledgedAt: issueDate,
        signedAt: issueDate,
        finalSignedAt: issueDate,
        documentHash: canonicalHash({
          employeeId: employee.id,
          topic: "Permit demo hazards, controls, and emergency actions",
          briefingDate: issueDate.toISOString(),
        }),
        createdByUserId: demoUser.id,
        updatedByUserId: demoUser.id,
      },
    });
    entryNo += 1;
  }

  for (const employee of [actor, manager, observer, crewMember]) {
    await upsertQualification({
      documentNumber: `PDM-CERT-${employee.employeeNumber}`,
      documentKind: "CERTIFICATE",
      employeeId: employee.id,
      issueDate,
      expiryDate,
    });
    await upsertQualification({
      documentNumber: `PDM-MED-${employee.employeeNumber}`,
      documentKind: "MEDICAL_CLEARANCE",
      employeeId: employee.id,
      issueDate,
      expiryDate,
    });
    await ensurePpe({
      employeeId: employee.id,
      itemCode: "PDM-BASIC-PPE",
      itemName: "Helmet, eye protection, gloves, safety footwear",
      issuedAt: issueDate,
      validUntil: expiryDate,
      createdByUserId: demoUser.id,
    });
  }
  for (const worker of [representative, contractorCrew]) {
    await upsertQualification({
      documentNumber: `PDM-CERT-${worker.workerNumber}`,
      documentKind: "CERTIFICATE",
      contractorWorkerId: worker.id,
      issueDate,
      expiryDate,
    });
    await upsertQualification({
      documentNumber: `PDM-MED-${worker.workerNumber}`,
      documentKind: "MEDICAL_CLEARANCE",
      contractorWorkerId: worker.id,
      issueDate,
      expiryDate,
    });
    await ensurePpe({
      contractorWorkerId: worker.id,
      itemCode: "PDM-BASIC-PPE",
      itemName: "Helmet, eye protection, gloves, safety footwear",
      issuedAt: issueDate,
      validUntil: expiryDate,
      createdByUserId: demoUser.id,
    });
  }

  await prisma.retentionPolicy.upsert({
    where: {
      organizationId_retentionCode_effectiveFrom: {
        organizationId,
        retentionCode: "PDM-WORK-PERMIT-5Y",
        effectiveFrom: new Date("2020-08-28T00:00:00.000Z"),
      },
    },
    update: {
      documentKind: "WORK_PERMIT",
      scopeType: "WORK_SITE",
      retentionValue: 5,
      retentionUnit: "YEARS",
      archiveFormat: "PDF_A_1",
      legalBasis: "Kazakhstan Order No. 344 demo retention policy placeholder",
    },
    create: {
      organizationId,
      retentionCode: "PDM-WORK-PERMIT-5Y",
      documentKind: "WORK_PERMIT",
      scopeType: "WORK_SITE",
      retentionValue: 5,
      retentionUnit: "YEARS",
      archiveFormat: "PDF_A_1",
      legalBasis: "Kazakhstan Order No. 344 demo retention policy placeholder",
      effectiveFrom: new Date("2020-08-28T00:00:00.000Z"),
      description:
        "Demo-only policy; confirm production retention with legal review.",
    },
  });

  const actId = "permit-demo-active-contractor-act";
  const envelopeId = "permit-demo-active-contractor-act-envelope";
  const versionId = "permit-demo-active-contractor-act-version";
  const actPayload = {
    source: "PERMIT_JOURNAL_UI_CANONICAL",
    documentType: "CONTRACTOR_ACCESS_ACT",
    legalBasis: "Kazakhstan Order No. 344, Appendix 3",
    legalBasisVersion: "KZ_ORDER_344_APPENDIX_3",
    legalBasisEffectiveDate: "2020-08-28",
    contractorAccessAct: {
      id: actId,
      organizationId,
      actNumber: "PDM-ACT-READY-001",
      status: "ACTIVE",
      scopeType: "WORK_SITE",
      branchId: branch.id,
      departmentId: department.id,
      workSiteId: workSite.id,
      contractorOrganizationId: contractor.id,
      contractorRepresentativeId: representative.id,
      hostRepresentativeEmployeeId: actor.id,
      hostUnitChiefEmployeeId: manager.id,
      workName: "General maintenance in demo workshop",
      workDescription: "Synthetic fallback act for the customer demo.",
      workArea: "Maintenance bay A",
      workAreaBoundaries: "Marked demo perimeter around bay A",
      workAreaCoordinates: null,
      validFrom: actValidFrom.toISOString(),
      validTo: actValidTo.toISOString(),
      safetyMeasures: [
        "Fence the work area.",
        "Apply lockout and tagout.",
        "Maintain emergency access.",
      ],
      specialConditions: "Demo data only.",
    },
  };
  const actPayloadHash = canonicalHash(actPayload);

  await prisma.$transaction(async (transaction) => {
    await transaction.documentEnvelope.upsert({
      where: { id: envelopeId },
      update: {
        organizationId,
        documentKind: "CONTRACTOR_ACCESS_ACT",
        scopeType: "WORK_SITE",
        branchId: branch.id,
        departmentId: department.id,
        workSiteId: workSite.id,
        documentNumber: "PDM-ACT-READY-001",
        title: "General maintenance in demo workshop",
        status: "ACTIVE",
      },
      create: {
        id: envelopeId,
        organizationId,
        documentKind: "CONTRACTOR_ACCESS_ACT",
        scopeType: "WORK_SITE",
        branchId: branch.id,
        departmentId: department.id,
        workSiteId: workSite.id,
        businessObjectType: "ContractorAccessAct",
        businessObjectId: actId,
        documentNumber: "PDM-ACT-READY-001",
        title: "General maintenance in demo workshop",
        status: "ACTIVE",
        createdByUserId: demoUser.id,
      },
    });
    await transaction.documentVersion.upsert({
      where: { id: versionId },
      update: {
        envelopeId,
        status: "FINAL",
        payloadJson: actPayload as Prisma.InputJsonValue,
        renderedHash: actPayloadHash,
        effectiveFrom: actValidFrom,
        effectiveTo: actValidTo,
      },
      create: {
        id: versionId,
        envelopeId,
        versionNo: 1,
        status: "FINAL",
        payloadJson: actPayload as Prisma.InputJsonValue,
        renderedHash: actPayloadHash,
        createdByUserId: demoUser.id,
        effectiveFrom: actValidFrom,
        effectiveTo: actValidTo,
      },
    });
    await transaction.documentEnvelope.update({
      where: { id: envelopeId },
      data: { currentVersionId: versionId },
    });
    await transaction.contractorAccessAct.upsert({
      where: { id: actId },
      update: {
        status: "ACTIVE",
        branchId: branch.id,
        departmentId: department.id,
        workSiteId: workSite.id,
        contractorOrganizationId: contractor.id,
        contractorRepresentativeId: representative.id,
        hostRepresentativeEmployeeId: actor.id,
        hostUnitChiefEmployeeId: manager.id,
        validFrom: actValidFrom,
        validTo: actValidTo,
        safetyMeasures: actPayload.contractorAccessAct
          .safetyMeasures as Prisma.InputJsonValue,
        documentEnvelopeId: envelopeId,
        currentVersionId: versionId,
        updatedByUserId: demoUser.id,
      },
      create: {
        id: actId,
        organizationId,
        actNumber: "PDM-ACT-READY-001",
        status: "ACTIVE",
        scopeType: "WORK_SITE",
        branchId: branch.id,
        departmentId: department.id,
        workSiteId: workSite.id,
        contractorOrganizationId: contractor.id,
        contractorRepresentativeId: representative.id,
        hostRepresentativeEmployeeId: actor.id,
        hostUnitChiefEmployeeId: manager.id,
        workName: "General maintenance in demo workshop",
        workDescription: "Synthetic fallback act for the customer demo.",
        workArea: "Maintenance bay A",
        workAreaBoundaries: "Marked demo perimeter around bay A",
        workAreaCoordinates: Prisma.JsonNull,
        validFrom: actValidFrom,
        validTo: actValidTo,
        safetyMeasures: actPayload.contractorAccessAct
          .safetyMeasures as Prisma.InputJsonValue,
        specialConditions: "Demo data only.",
        legalBasis: "Kazakhstan Order No. 344, Appendix 3",
        legalBasisVersion: "KZ_ORDER_344_APPENDIX_3",
        legalBasisEffectiveDate: new Date("2020-08-28T00:00:00.000Z"),
        documentEnvelopeId: envelopeId,
        currentVersionId: versionId,
        createdByUserId: demoUser.id,
        updatedByUserId: demoUser.id,
      },
    });
  });

  console.log(
    JSON.stringify(
      {
        organizationId,
        demoUserEmail,
        workSiteId: workSite.id,
        actorEmployeeId: actor.id,
        suggestedSingleUserWorkflowAssignments: {
          issuerId: actor.id,
          responsibleManagerId: actor.id,
          workProducerId: actor.id,
          admitterId: actor.id,
        },
        observerEmployeeId: observer.id,
        internalCrewEmployeeId: crewMember.id,
        contractorOrganizationId: contractor.id,
        contractorRepresentativeId: representative.id,
        contractorCrewWorkerId: contractorCrew.id,
        fallbackActiveContractorAccessActId: actId,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
