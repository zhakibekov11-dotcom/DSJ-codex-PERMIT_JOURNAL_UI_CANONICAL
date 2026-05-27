import { hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { createPrismaClient } from "../src/client";
import { encryptSensitiveValue, hashSensitiveValue, maskIin } from "../src/security";

const prisma = createPrismaClient();

function hashDocumentPayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

function isTruthyEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isLocalDatabaseUrl(databaseUrl: string) {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function assertSeedSafetyGuards() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before running the destructive seed.");
  }

  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("Refusing to run the destructive seed when NODE_ENV=production.");
  }

  if (!isTruthyEnv(process.env.SEED_ALLOW_DESTRUCTIVE_RESET)) {
    throw new Error(
      "Refusing to run the destructive seed without SEED_ALLOW_DESTRUCTIVE_RESET=true.",
    );
  }

  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error(
      "Refusing to run the destructive seed against a non-local DATABASE_URL.",
    );
  }
}

function readRequiredSeedEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required before running the destructive seed.`);
  }

  return value;
}

async function main() {
  assertSeedSafetyGuards();

  const superAdminEmail = readRequiredSeedEnv("SEED_SUPER_ADMIN_EMAIL");
  const superAdminPassword = readRequiredSeedEnv("SEED_SUPER_ADMIN_PASSWORD");
  const companyAdminEmail = readRequiredSeedEnv("SEED_COMPANY_ADMIN_EMAIL");
  const companyAdminPassword = readRequiredSeedEnv(
    "SEED_COMPANY_ADMIN_PASSWORD",
  );
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  await prisma.examAttempt.deleteMany();
  await prisma.examOption.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.safetyCertificate.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.trainingAssignment.deleteMany();
  await prisma.trainingProgram.deleteMany();
  await prisma.notificationJob.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.briefingRecord.deleteMany();
  await prisma.briefingBatch.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.contractorCompany.deleteMany();
  await prisma.site.deleteMany();
  await prisma.department.deleteMany();
  await prisma.company.deleteMany();
  await prisma.organization.deleteMany({
    where: {
      OR: [
        { id: { in: ["demo-company-alpina", "demo-company-steppe"] } },
        { code: { in: ["BIN-190140028341", "BIN-180940011772"] } },
      ],
    },
  });

  const adminPassword = await hash(superAdminPassword, 12);
  const companyAdminPasswordHash = await hash(companyAdminPassword, 12);
  const workerDate = new Date();

  const alpina = await prisma.company.create({
    data: {
      id: "demo-company-alpina",
      name: "Stroy Company 2030",
      bin: "190140028341",
      industry: "Промышленное обслуживание",
      timezone: "Asia/Almaty",
    },
  });

  const steppe = await prisma.company.create({
    data: {
      id: "demo-company-steppe",
      name: "Steppe Build Group",
      bin: "180940011772",
      industry: "Строительство",
      timezone: "Asia/Almaty",
    },
  });

  const [hseDepartment, drillingDepartment, mechanicalDepartment] = await Promise.all([
    prisma.department.create({
      data: {
        companyId: alpina.id,
        name: "ОТ и ПБ",
        code: "HSE",
      },
    }),
    prisma.department.create({
      data: {
        companyId: alpina.id,
        name: "Бурение",
        code: "DRL",
      },
    }),
    prisma.department.create({
      data: {
        companyId: alpina.id,
        name: "Механический участок",
        code: "MEC",
      },
    }),
  ]);

  const [westPad, atyrauBase] = await Promise.all([
    prisma.site.create({
      data: {
        companyId: alpina.id,
        name: "Площадка Запад-14",
        location: "Атырауская область",
      },
    }),
    prisma.site.create({
      data: {
        companyId: alpina.id,
        name: "Атырауская сервисная база",
        location: "Атырау",
      },
    }),
  ]);

  const alpinaOrganization = await prisma.organization.create({
    data: {
      id: alpina.id,
      legacyCompanyId: alpina.id,
      code: "BIN-190140028341",
      name: alpina.name,
      bin: alpina.bin,
      timezone: alpina.timezone,
      isActive: alpina.isActive,
    },
  });

  const [
    directorPosition,
    safetyEngineerPosition,
    shopChiefPosition,
    drillingOperatorPosition,
    mechanicPosition,
    logisticsCoordinatorPosition,
    riggingContractorPosition,
    contractorCoordinatorPosition,
  ] = await Promise.all([
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "DIR",
        name: "Директор",
        grade: "Руководство",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "HSE-ENG",
        name: "Инженер по охране труда",
        grade: "HSE",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "SHOP-CHIEF",
        name: "Начальник цеха",
        grade: "Линейный руководитель",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "DRL-OP",
        name: "Оператор бурения",
        grade: "Полевая бригада",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "MEC",
        name: "Механик",
        grade: "Производство",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "LOG-COORD",
        name: "Координатор по логистике",
        grade: "Операции",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "CTR-RIG",
        name: "Подрядчик по такелажным работам",
        grade: "Подрядчик",
      },
    }),
    prisma.position.create({
      data: {
        organizationId: alpinaOrganization.id,
        code: "CTR-COORD",
        name: "Координатор подрядной бригады",
        grade: "Подрядчик",
      },
    }),
  ]);

  const [caspianContractor, qazaqContractor] = await Promise.all([
    prisma.contractorCompany.create({
      data: {
        companyId: alpina.id,
        name: "Caspian Energy Support LLP",
        bin: "220340018877",
        contactEmail: "dispatch@caspian-support.kz",
        contactPhone: "+77015550121",
        notes: "Подрядчик по полевым сервисам и мобилизации персонала.",
      },
    }),
    prisma.contractorCompany.create({
      data: {
        companyId: alpina.id,
        name: "Qazaq Field Services",
        bin: "210940027611",
        contactEmail: "hse@qfs.kz",
        contactPhone: "+77015550122",
        notes: "Подрядная компания для логистики и складских операций.",
      },
    }),
  ]);

  const [
    superAdmin,
    companyAdmin,
    directorUser,
    safetyEngineer,
    shopChiefUser,
    employeeSigner,
  ] = await Promise.all([
    prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: adminPassword,
        fullName: "Суперадминистратор платформы",
        role: "SUPER_ADMIN",
        lastLoginAt: workerDate,
      },
    }),
    prisma.user.create({
      data: {
        companyId: alpina.id,
        departmentId: hseDepartment.id,
        siteId: atyrauBase.id,
        email: companyAdminEmail,
        passwordHash: companyAdminPasswordHash,
        fullName: "Aigerim Sadykova",
        role: "COMPANY_ADMIN",
        lastLoginAt: workerDate,
      },
    }),
    prisma.user.create({
      data: {
        companyId: alpina.id,
        departmentId: hseDepartment.id,
        siteId: atyrauBase.id,
        email: "director@alpina.local",
        passwordHash: companyAdminPasswordHash,
        fullName: "Serik Mukashev",
        role: "COMPANY_ADMIN",
        lastLoginAt: workerDate,
      },
    }),
    prisma.user.create({
      data: {
        companyId: alpina.id,
        departmentId: hseDepartment.id,
        siteId: westPad.id,
        email: "safety.engineer@alpina.local",
        passwordHash: companyAdminPasswordHash,
        fullName: "Marat Kairatuly",
        role: "SAFETY_ENGINEER",
        lastLoginAt: workerDate,
      },
    }),
    prisma.user.create({
      data: {
        companyId: alpina.id,
        departmentId: drillingDepartment.id,
        siteId: westPad.id,
        email: "shop.chief@alpina.local",
        passwordHash: companyAdminPasswordHash,
        fullName: "Bauyrzhan Imanov",
        role: "COMPANY_ADMIN",
        lastLoginAt: workerDate,
      },
    }),
    prisma.user.create({
      data: {
        companyId: alpina.id,
        departmentId: drillingDepartment.id,
        siteId: westPad.id,
        email: "signer.employee@alpina.local",
        passwordHash: companyAdminPasswordHash,
        fullName: "Daulet Nurpeisov",
        role: "EMPLOYEE_SIGNER",
        lastLoginAt: workerDate,
      },
    }),
  ]);

  await prisma.user.create({
    data: {
      companyId: steppe.id,
      email: "admin@steppebuild.local",
      passwordHash: companyAdminPasswordHash,
      fullName: "Dinara Toktar",
      role: "COMPANY_ADMIN",
      lastLoginAt: workerDate,
    },
  });

  const employeeSeeds = [
    {
      fullName: "Daulet Nurpeisov",
      iin: "980317350011",
      employeeNumber: "AIS-001",
      jobTitle: "Оператор бурения",
      jobTitleKz: "Бұрғылау операторы",
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      positionId: drillingOperatorPosition.id,
      userId: employeeSigner.id,
      email: "d.nurpeisov@alpina.local",
      phone: "+77015550011",
    },
    {
      fullName: "Aruzhan Bektassova",
      iin: "910823400120",
      employeeNumber: "AIS-002",
      jobTitle: "Специалист по охране труда",
      jobTitleKz: "Еңбекті қорғау маманы",
      departmentId: hseDepartment.id,
      siteId: atyrauBase.id,
      positionId: safetyEngineerPosition.id,
      email: "a.bektassova@alpina.local",
      phone: "+77015550012",
    },
    {
      fullName: "Nursultan Aitbayev",
      iin: "890502450333",
      employeeNumber: "AIS-003",
      jobTitle: "Механик",
      jobTitleKz: "Механик",
      departmentId: mechanicalDepartment.id,
      siteId: westPad.id,
      positionId: mechanicPosition.id,
      email: "n.aitbayev@alpina.local",
      phone: "+77015550013",
    },
    {
      fullName: "Madina Bazarbayeva",
      iin: "960117400445",
      employeeNumber: "AIS-004",
      jobTitle: "Координатор по логистике",
      jobTitleKz: "Логистика үйлестірушісі",
      departmentId: mechanicalDepartment.id,
      siteId: atyrauBase.id,
      positionId: logisticsCoordinatorPosition.id,
      email: "m.bazarbayeva@alpina.local",
      phone: "+77015550014",
    },
    {
      fullName: "Temirlan Sabitov",
      iin: "930425350551",
      employeeNumber: "CTR-001",
      jobTitle: "Подрядчик по такелажным работам",
      jobTitleKz: "Такелаж жұмыстары бойынша мердігер",
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      positionId: riggingContractorPosition.id,
      email: "t.sabitov@caspian-support.kz",
      phone: "+77015550021",
      employeeKind: "CONTRACTOR" as const,
      contractorCompanyId: caspianContractor.id,
    },
    {
      fullName: "Saltanat Yessenova",
      iin: "950731400662",
      employeeNumber: "CTR-002",
      jobTitle: "Координатор подрядной бригады",
      jobTitleKz: "Мердігер бригадасының үйлестірушісі",
      departmentId: mechanicalDepartment.id,
      siteId: atyrauBase.id,
      positionId: contractorCoordinatorPosition.id,
      email: "s.yessenova@qfs.kz",
      phone: "+77015550022",
      employeeKind: "CONTRACTOR" as const,
      contractorCompanyId: qazaqContractor.id,
    },
    {
      fullName: "Serik Mukashev",
      iin: "870214350777",
      employeeNumber: "AIS-010",
      jobTitle: "Директор",
      jobTitleKz: "Директор",
      departmentId: hseDepartment.id,
      siteId: atyrauBase.id,
      positionId: directorPosition.id,
      userId: directorUser.id,
      email: "director@alpina.local",
      phone: "+77015550031",
    },
    {
      fullName: "Bauyrzhan Imanov",
      iin: "880619350888",
      employeeNumber: "AIS-011",
      jobTitle: "Начальник цеха",
      jobTitleKz: "Цех басшысы",
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      positionId: shopChiefPosition.id,
      userId: shopChiefUser.id,
      email: "shop.chief@alpina.local",
      phone: "+77015550032",
    },
  ];

  const employees = await Promise.all(
    employeeSeeds.map((employee) =>
      prisma.employee.create({
        data: {
          companyId: alpina.id,
          departmentId: employee.departmentId,
          siteId: employee.siteId,
          positionId: employee.positionId,
          userId: employee.userId ?? null,
          contractorCompanyId: employee.contractorCompanyId ?? null,
          fullName: employee.fullName,
          iinEncrypted: encryptSensitiveValue(employee.iin),
          iinHash: hashSensitiveValue(employee.iin),
          iinLast4: employee.iin.slice(-4),
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          jobTitleKz: employee.jobTitleKz,
          email: employee.email,
          phone: employee.phone,
          employeeKind: employee.employeeKind ?? "INTERNAL",
          status: "active",
        },
      }),
    ),
  );

  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  const tenDaysAhead = new Date(now);
  tenDaysAhead.setDate(now.getDate() + 10);
  const twoDaysAhead = new Date(now);
  twoDaysAhead.setDate(now.getDate() + 2);
  const twoWeeksAhead = new Date(now);
  twoWeeksAhead.setDate(now.getDate() + 14);
  const oneYearAhead = new Date(now);
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

  const signedRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      employeeId: employees[0].id,
      instructorUserId: safetyEngineer.id,
      briefingType: "PRIMARY",
      briefingDate: twoWeeksAgo,
      completionDueAt: threeDaysAgo,
      nextBriefingDueAt: tenDaysAhead,
      topic: "Первичный инструктаж на объекте и информирование об опасностях",
      notes: "Проведён при мобилизации на площадку Запад-14.",
      materialContent:
        "1. Проверить исправность СИЗ перед выходом на площадку.\n2. Подтвердить маршрут эвакуации и точки сбора.\n3. Не приступать к работам без наряда и подтверждённого допуска.",
      status: "SIGNED",
      employeeStatus: "SIGNED",
      documentNumber: "AIS-BR-0001",
      documentHash: hashDocumentPayload("AIS-BR-0001"),
      openedAt: twoWeeksAgo,
      acknowledgedAt: threeDaysAgo,
      signedAt: threeDaysAgo,
    },
  });

  await prisma.signature.create({
    data: {
      companyId: alpina.id,
      briefingRecordId: signedRecord.id,
      signerUserId: employeeSigner.id,
      signerEmployeeId: employees[0].id,
      provider: "MOCK_NCALAYER",
      status: "SIGNED",
      signerName: employees[0].fullName,
      signerIinMasked: maskIin(employeeSeeds[0].iin),
      certificateSerial: "MOCKCERT-ALPINA-0001",
      documentHash: signedRecord.documentHash ?? hashDocumentPayload("AIS-BR-0001"),
      signedAt: threeDaysAgo,
      ipAddress: "127.0.0.1",
      userAgent: "seed-script",
      payload: {
        provider: "MOCK_NCALAYER",
        signedBy: employees[0].fullName,
        signedAt: threeDaysAgo.toISOString(),
      },
    },
  });

  const readyRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: hseDepartment.id,
      siteId: atyrauBase.id,
      employeeId: employees[1].id,
      instructorUserId: companyAdmin.id,
      briefingType: "INTRODUCTORY",
      briefingDate: threeDaysAgo,
      completionDueAt: twoDaysAhead,
      topic: "Вводный инструктаж по офисной безопасности и порядку эскалации инцидентов",
      notes: "Ожидает подтверждения подписанта.",
      materialContent:
        "Ознакомьтесь с правилами доступа в офис, порядком эскалации инцидентов, схемой эвакуации и контактами ответственных лиц.",
      status: "READY_FOR_SIGNING",
      employeeStatus: "ASSIGNED",
      documentNumber: "AIS-BR-0002",
      documentHash: hashDocumentPayload("AIS-BR-0002"),
    },
  });

  const employeeCabinetRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      employeeId: employees[0].id,
      instructorUserId: safetyEngineer.id,
      briefingType: "INTRODUCTORY",
      briefingDate: now,
      completionDueAt: twoDaysAhead,
      topic: "Вводный инструктаж перед началом смены на площадке Запад-14",
      notes: "Назначен в личный кабинет сотрудника для прохождения и подписи.",
      materialContent:
        "Перед началом смены проверьте комплект СИЗ, подтвердите место сбора при эвакуации, не приступайте к работам без допуска и сообщайте об опасных условиях немедленно руководителю смены.",
      status: "READY_FOR_SIGNING",
      employeeStatus: "ASSIGNED",
      documentNumber: "AIS-BR-0006",
      documentHash: hashDocumentPayload("AIS-BR-0006"),
    },
  });

  const overdueRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: mechanicalDepartment.id,
      siteId: westPad.id,
      employeeId: employees[2].id,
      instructorUserId: safetyEngineer.id,
      briefingType: "REPEATED",
      briefingDate: twoWeeksAgo,
      completionDueAt: threeDaysAgo,
      nextBriefingDueAt: threeDaysAgo,
      topic: "Повторный инструктаж по процедуре LOTO",
      notes: "Срок истёк, требуется назначить проведение на этой неделе.",
      materialContent:
        "Подтвердите порядок блокировки и маркировки, запрет снятия замков посторонними лицами и контроль перед повторным включением оборудования.",
      status: "READY_FOR_SIGNING",
      employeeStatus: "ASSIGNED",
      documentNumber: "AIS-BR-0003",
      documentHash: hashDocumentPayload("AIS-BR-0003"),
    },
  });

  const draftRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: mechanicalDepartment.id,
      siteId: atyrauBase.id,
      employeeId: employees[3].id,
      instructorUserId: companyAdmin.id,
      briefingType: "TARGETED",
      briefingDate: now,
      nextBriefingDueAt: twoDaysAhead,
      topic: "Целевой инструктаж по грузоподъёмным операциям на складе",
      notes: "Черновик, ожидает финальной формулировки темы.",
      status: "DRAFT",
      documentNumber: "AIS-BR-0004",
    },
  });

  const archivedRecord = await prisma.briefingRecord.create({
    data: {
      companyId: alpina.id,
      departmentId: drillingDepartment.id,
      siteId: westPad.id,
      employeeId: employees[0].id,
      instructorUserId: safetyEngineer.id,
      briefingType: "UNSCHEDULED",
      briefingDate: twoWeeksAgo,
      topic: "Внеплановый инструктаж после инцидента",
      notes: "Переведён в архив после исправления дублирующей записи.",
      status: "ARCHIVED",
      documentNumber: "AIS-BR-0005",
      archivedAt: now,
    },
  });

  const contractorBatch = await prisma.briefingBatch.create({
    data: {
      companyId: alpina.id,
      batchNumber: "DSJ-2026-0001",
      participantCount: 2,
    },
  });

  const contractorBatchRecords = await Promise.all([
    prisma.briefingRecord.create({
      data: {
        companyId: alpina.id,
        briefingBatchId: contractorBatch.id,
        departmentId: drillingDepartment.id,
        siteId: westPad.id,
        employeeId: employees[4].id,
        instructorUserId: safetyEngineer.id,
        briefingType: "TARGETED",
        briefingDate: now,
        completionDueAt: twoWeeksAhead,
        nextBriefingDueAt: twoWeeksAhead,
        topic: "Целевой инструктаж подрядной бригады перед грузоподъёмными работами",
        notes: "Подрядчику отправлена персональная ссылка на регистрацию и подписание.",
        materialContent:
          "До начала грузоподъёмных работ подтвердите зону ограждения, сигналы стропальщика и запрет нахождения под грузом.",
        status: "READY_FOR_SIGNING",
        employeeStatus: "ASSIGNED",
        documentNumber: "DSJ-2026-0001/01",
        documentHash: hashDocumentPayload("DSJ-2026-0001/01"),
        inviteToken: "seed-invite-temirlan",
        inviteTokenExpiresAt: twoWeeksAhead,
        inviteSentAt: now,
      },
    }),
    prisma.briefingRecord.create({
      data: {
        companyId: alpina.id,
        briefingBatchId: contractorBatch.id,
        departmentId: drillingDepartment.id,
        siteId: westPad.id,
        employeeId: employees[5].id,
        instructorUserId: safetyEngineer.id,
        briefingType: "TARGETED",
        briefingDate: now,
        completionDueAt: twoWeeksAhead,
        nextBriefingDueAt: twoWeeksAhead,
        topic: "Целевой инструктаж подрядной бригады перед грузоподъёмными работами",
        notes: "Подрядчику отправлена персональная ссылка на регистрацию и подписание.",
        materialContent:
          "До начала грузоподъёмных работ подтвердите зону ограждения, сигналы стропальщика и запрет нахождения под грузом.",
        status: "READY_FOR_SIGNING",
        employeeStatus: "ASSIGNED",
        documentNumber: "DSJ-2026-0001/02",
        documentHash: hashDocumentPayload("DSJ-2026-0001/02"),
        inviteToken: "seed-invite-saltanat",
        inviteTokenExpiresAt: twoWeeksAhead,
        inviteSentAt: now,
      },
    }),
  ]);

  const completedTrainingProgram = await prisma.trainingProgram.create({
    data: {
      companyId: alpina.id,
      title: "Подтверждение знаний по безопасной работе на площадке",
      description:
        "Краткая программа для закрепления базовых требований по доступу на площадку, СИЗ и эскалации опасностей.",
      materialContent:
        "1. Проверить пропуск и комплект СИЗ.\n2. Подтвердить маршрут эвакуации.\n3. Не приступать к работам без допуска и наряда.",
      issuerName: "Alpina HSE Academy",
      requiresExam: false,
      createsDocument: true,
      createsSafetyCertificate: true,
    },
  });

  const completedTrainingAssignment = await prisma.trainingAssignment.create({
    data: {
      companyId: alpina.id,
      employeeId: employees[0].id,
      trainingProgramId: completedTrainingProgram.id,
      assignedByUserId: safetyEngineer.id,
      dueAt: threeDaysAgo,
      status: "COMPLETED",
      progressPercent: 100,
      startedAt: twoWeeksAgo,
      completedAt: threeDaysAgo,
    },
  });

  await prisma.employeeDocument.create({
    data: {
      companyId: alpina.id,
      employeeId: employees[0].id,
      trainingAssignmentId: completedTrainingAssignment.id,
      title: `Подтверждение прохождения: ${completedTrainingProgram.title}`,
      documentType: "COMPLETION_CONFIRMATION",
      issueDate: threeDaysAgo,
      issuerName: "Alpina HSE Academy",
      status: "ACTIVE",
    },
  });

  const certificateDocument = await prisma.employeeDocument.create({
    data: {
      companyId: alpina.id,
      employeeId: employees[0].id,
      trainingAssignmentId: completedTrainingAssignment.id,
      title: `Удостоверение по ТБ: ${completedTrainingProgram.title}`,
      documentType: "SAFETY_CERTIFICATE",
      issueDate: threeDaysAgo,
      expiryDate: oneYearAhead,
      issuerName: "Alpina HSE Academy",
      status: "ACTIVE",
    },
  });

  await prisma.safetyCertificate.create({
    data: {
      companyId: alpina.id,
      employeeId: employees[0].id,
      trainingAssignmentId: completedTrainingAssignment.id,
      documentId: certificateDocument.id,
      certificateNumber: "TB-2026-0001",
      issueDate: threeDaysAgo,
      expiryDate: oneYearAhead,
      issuerName: "Alpina HSE Academy",
      status: "ACTIVE",
    },
  });

  const assignedTrainingProgram = await prisma.trainingProgram.create({
    data: {
      companyId: alpina.id,
      title: "Обучение по безопасной работе на высоте",
      description:
        "Практический модуль по допуску к работам на высоте, предсменной проверке оборудования и безопасному позиционированию.",
      materialContent:
        "Перед выходом на высоту сотрудник обязан проверить страховочную систему, точку анкерного крепления, маршрут доступа и наличие действующего допуска.",
      materialFileName: "work-at-height-checklist.pdf",
      materialFileUrl: "https://example.com/training/work-at-height-checklist.pdf",
      videoUrl: "https://example.com/training/work-at-height-video",
      issuerName: "Alpina HSE Academy",
      requiresExam: true,
      createsDocument: true,
      createsSafetyCertificate: true,
    },
  });

  await prisma.trainingAssignment.create({
    data: {
      companyId: alpina.id,
      employeeId: employees[0].id,
      trainingProgramId: assignedTrainingProgram.id,
      assignedByUserId: safetyEngineer.id,
      dueAt: twoWeeksAhead,
      status: "ASSIGNED",
      progressPercent: 0,
    },
  });

  await prisma.exam.create({
    data: {
      companyId: alpina.id,
      trainingProgramId: assignedTrainingProgram.id,
      title: "Проверка знаний по безопасной работе на высоте",
      description: "Проверка базовых правил допуска, осмотра СИЗ и фиксации рабочего места на высоте.",
      passingScore: 80,
      maxAttempts: 3,
      questions: {
        create: [
          {
            prompt: "Что сотрудник должен сделать перед началом работ на высоте?",
            sortOrder: 0,
            options: {
              create: [
                { text: "Проверить страховочную систему и точку крепления", sortOrder: 0, isCorrect: true },
                { text: "Сразу подняться на рабочее место", sortOrder: 1, isCorrect: false },
                { text: "Снять каску для удобства обзора", sortOrder: 2, isCorrect: false },
              ],
            },
          },
          {
            prompt: "Когда можно приступать к работам на высоте?",
            sortOrder: 1,
            options: {
              create: [
                { text: "После устного согласования с коллегой", sortOrder: 0, isCorrect: false },
                { text: "После проверки допуска, СИЗ и безопасного доступа", sortOrder: 1, isCorrect: true },
                { text: "Если объект знаком и раньше там уже работали", sortOrder: 2, isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  const [unsignedReminder, employeeCabinetReminder, overdueReminder] = await Promise.all([
    prisma.reminder.create({
      data: {
        companyId: alpina.id,
        briefingRecordId: readyRecord.id,
        employeeId: employees[1].id,
        type: "UNSIGNED_RECORD_PENDING",
        status: "pending",
        title: "Ожидается подпись под инструктажем",
        message: "Вводный инструктаж AIS-BR-0002 готов к подписанию.",
        dueAt: twoDaysAhead,
      },
    }),
    prisma.reminder.create({
      data: {
        companyId: alpina.id,
        briefingRecordId: employeeCabinetRecord.id,
        employeeId: employees[0].id,
        type: "UNSIGNED_RECORD_PENDING",
        status: "pending",
        title: "Сотруднику назначен новый инструктаж",
        message: "В личном кабинете появился инструктаж AIS-BR-0006, требуется ознакомление и подпись.",
        dueAt: twoDaysAhead,
      },
    }),
    prisma.reminder.create({
      data: {
        companyId: alpina.id,
        briefingRecordId: overdueRecord.id,
        employeeId: employees[2].id,
        type: "REPEATED_BRIEFING_OVERDUE",
        status: "pending",
        title: "Просрочен повторный инструктаж",
        message: "Повторный инструктаж AIS-BR-0003 просрочен.",
        dueAt: now,
      },
    }),
  ]);

  await prisma.notificationJob.createMany({
    data: [
      {
        companyId: alpina.id,
        reminderId: unsignedReminder.id,
        briefingRecordId: readyRecord.id,
        assigneeUserId: companyAdmin.id,
        channel: "IN_APP",
        type: "UNSIGNED_RECORD_PENDING",
        status: "queued",
        scheduledAt: now,
        payload: {
          title: unsignedReminder.title,
          message: unsignedReminder.message,
        },
      },
      {
        companyId: alpina.id,
        reminderId: employeeCabinetReminder.id,
        briefingRecordId: employeeCabinetRecord.id,
        assigneeUserId: safetyEngineer.id,
        channel: "IN_APP",
        type: "UNSIGNED_RECORD_PENDING",
        status: "queued",
        scheduledAt: now,
        payload: {
          title: employeeCabinetReminder.title,
          message: employeeCabinetReminder.message,
        },
      },
      {
        companyId: alpina.id,
        reminderId: overdueReminder.id,
        briefingRecordId: overdueRecord.id,
        assigneeUserId: safetyEngineer.id,
        channel: "IN_APP",
        type: "REPEATED_BRIEFING_OVERDUE",
        status: "queued",
        scheduledAt: now,
        payload: {
          title: overdueReminder.title,
          message: overdueReminder.message,
        },
      },
      {
        companyId: alpina.id,
        briefingRecordId: contractorBatchRecords[0].id,
        assigneeUserId: safetyEngineer.id,
        channel: "EMAIL",
        type: "SIGNING_LINK_INVITE",
        status: "queued",
        scheduledAt: now,
        payload: {
          title: "Ссылка на регистрацию и подписание инструктажа",
          message: "Подрядчику отправлена персональная ссылка на регистрацию и подписание журнала по ТБ.",
          link: `${appUrl}/invite/seed-invite-temirlan`,
          employeeName: employees[4].fullName,
          contractorCompanyName: caspianContractor.name,
          deliveryTarget: employees[4].email,
        },
      },
      {
        companyId: alpina.id,
        briefingRecordId: contractorBatchRecords[1].id,
        assigneeUserId: safetyEngineer.id,
        channel: "EMAIL",
        type: "SIGNING_LINK_INVITE",
        status: "queued",
        scheduledAt: now,
        payload: {
          title: "Ссылка на регистрацию и подписание инструктажа",
          message: "Подрядчику отправлена персональная ссылка на регистрацию и подписание журнала по ТБ.",
          link: `${appUrl}/invite/seed-invite-saltanat`,
          employeeName: employees[5].fullName,
          contractorCompanyName: qazaqContractor.name,
          deliveryTarget: employees[5].email,
        },
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        briefingRecordId: signedRecord.id,
        action: "briefing.signed",
        entityType: "BriefingRecord",
        entityId: signedRecord.id,
        metadata: {
          documentNumber: signedRecord.documentNumber,
          signer: employees[0].fullName,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: companyAdmin.id,
        briefingRecordId: readyRecord.id,
        action: "briefing.ready_for_signing",
        entityType: "BriefingRecord",
        entityId: readyRecord.id,
        metadata: {
          documentNumber: readyRecord.documentNumber,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        briefingRecordId: employeeCabinetRecord.id,
        action: "briefing.created",
        entityType: "BriefingRecord",
        entityId: employeeCabinetRecord.id,
        metadata: {
          documentNumber: employeeCabinetRecord.documentNumber,
          employeePortal: true,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: companyAdmin.id,
        briefingRecordId: archivedRecord.id,
        action: "briefing.archived",
        entityType: "BriefingRecord",
        entityId: archivedRecord.id,
        metadata: {
          documentNumber: archivedRecord.documentNumber,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: superAdmin.id,
        action: "company.created",
        entityType: "Company",
        entityId: alpina.id,
        metadata: {
          companyName: alpina.name,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        action: "contractor_company.created",
        entityType: "ContractorCompany",
        entityId: caspianContractor.id,
        metadata: {
          contractorCompanyName: caspianContractor.name,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        action: "contractor_company.created",
        entityType: "ContractorCompany",
        entityId: qazaqContractor.id,
        metadata: {
          contractorCompanyName: qazaqContractor.name,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        action: "training.created",
        entityType: "TrainingProgram",
        entityId: completedTrainingProgram.id,
        metadata: {
          title: completedTrainingProgram.title,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        action: "training.completed",
        entityType: "TrainingAssignment",
        entityId: completedTrainingAssignment.id,
        metadata: {
          trainingProgramId: completedTrainingProgram.id,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        action: "training.created",
        entityType: "TrainingProgram",
        entityId: assignedTrainingProgram.id,
        metadata: {
          title: assignedTrainingProgram.title,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        briefingRecordId: contractorBatchRecords[0].id,
        action: "briefing.created",
        entityType: "BriefingRecord",
        entityId: contractorBatchRecords[0].id,
        metadata: {
          documentNumber: contractorBatch.batchNumber,
          participantCount: contractorBatch.participantCount,
        },
      },
      {
        companyId: alpina.id,
        actorUserId: safetyEngineer.id,
        briefingRecordId: draftRecord.id,
        action: "briefing.created",
        entityType: "BriefingRecord",
        entityId: draftRecord.id,
        metadata: {
          documentNumber: draftRecord.documentNumber,
        },
      },
    ],
  });
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
