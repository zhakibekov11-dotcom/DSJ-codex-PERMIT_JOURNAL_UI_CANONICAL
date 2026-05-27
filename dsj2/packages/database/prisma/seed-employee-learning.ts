import { createPrismaClient } from "../src/client";

const prisma = createPrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      email: "signer.employee@alpina.local",
    },
  });

  if (!user?.companyId) {
    throw new Error("Не найден demo-пользователь сотрудника signer.employee@alpina.local.");
  }

  const employee = await prisma.employee.findFirst({
    where: {
      userId: user.id,
      companyId: user.companyId,
    },
  });

  if (!employee) {
    throw new Error("Не найдена карточка сотрудника, привязанная к demo-пользователю.");
  }

  const assigner = await prisma.user.findFirst({
    where: {
      companyId: user.companyId,
      role: "SAFETY_ENGINEER",
      isActive: true,
    },
  });

  if (!assigner) {
    throw new Error("Не найден активный инженер по ТБ для назначения обучения.");
  }

  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);
  const twoWeeksAhead = new Date(now);
  twoWeeksAhead.setDate(now.getDate() + 14);
  const oneYearAhead = new Date(now);
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

  let completedTrainingProgram = await prisma.trainingProgram.findFirst({
    where: {
      companyId: user.companyId,
      title: "Подтверждение знаний по безопасной работе на площадке",
    },
  });

  if (!completedTrainingProgram) {
    completedTrainingProgram = await prisma.trainingProgram.create({
      data: {
        companyId: user.companyId,
        title: "Подтверждение знаний по безопасной работе на площадке",
        description:
          "Краткая программа для закрепления базовых требований по доступу на площадку, СИЗ и эскалации опасностей.",
        materialContent:
          "1. Проверить пропуск и комплект СИЗ.\n2. Подтвердить маршрут эвакуации.\n3. Не приступать к работам без допуска и наряда.",
        issuerName: "Stroy Company 2030 HSE Academy",
        requiresExam: false,
        createsDocument: true,
        createsSafetyCertificate: true,
      },
    });
  }

  let completedAssignment = await prisma.trainingAssignment.findFirst({
    where: {
      employeeId: employee.id,
      trainingProgramId: completedTrainingProgram.id,
    },
  });

  if (!completedAssignment) {
    completedAssignment = await prisma.trainingAssignment.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        trainingProgramId: completedTrainingProgram.id,
        assignedByUserId: assigner.id,
        dueAt: threeDaysAgo,
        status: "COMPLETED",
        progressPercent: 100,
        startedAt: twoWeeksAgo,
        completedAt: threeDaysAgo,
      },
    });
  }

  const existingCompletionDocument = await prisma.employeeDocument.findFirst({
    where: {
      trainingAssignmentId: completedAssignment.id,
      documentType: "COMPLETION_CONFIRMATION",
    },
  });

  if (!existingCompletionDocument) {
    await prisma.employeeDocument.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        trainingAssignmentId: completedAssignment.id,
        title: `Подтверждение прохождения: ${completedTrainingProgram.title}`,
        documentType: "COMPLETION_CONFIRMATION",
        issueDate: threeDaysAgo,
        issuerName: "Stroy Company 2030 HSE Academy",
        status: "ACTIVE",
      },
    });
  }

  let certificateDocument = await prisma.employeeDocument.findFirst({
    where: {
      trainingAssignmentId: completedAssignment.id,
      documentType: "SAFETY_CERTIFICATE",
    },
  });

  if (!certificateDocument) {
    certificateDocument = await prisma.employeeDocument.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        trainingAssignmentId: completedAssignment.id,
        title: `Удостоверение по ТБ: ${completedTrainingProgram.title}`,
        documentType: "SAFETY_CERTIFICATE",
        issueDate: threeDaysAgo,
        expiryDate: oneYearAhead,
        issuerName: "Stroy Company 2030 HSE Academy",
        status: "ACTIVE",
      },
    });
  }

  const existingCertificate = await prisma.safetyCertificate.findFirst({
    where: {
      trainingAssignmentId: completedAssignment.id,
    },
  });

  if (!existingCertificate) {
    await prisma.safetyCertificate.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        trainingAssignmentId: completedAssignment.id,
        documentId: certificateDocument.id,
        certificateNumber: "TB-2026-0001",
        issueDate: threeDaysAgo,
        expiryDate: oneYearAhead,
        issuerName: "Stroy Company 2030 HSE Academy",
        status: "ACTIVE",
      },
    });
  }

  let assignedTrainingProgram = await prisma.trainingProgram.findFirst({
    where: {
      companyId: user.companyId,
      title: "Обучение по безопасной работе на высоте",
    },
    include: {
      exam: true,
    },
  });

  if (!assignedTrainingProgram) {
    assignedTrainingProgram = await prisma.trainingProgram.create({
      data: {
        companyId: user.companyId,
        title: "Обучение по безопасной работе на высоте",
        description:
          "Практический модуль по допуску к работам на высоте, предсменной проверке оборудования и безопасному позиционированию.",
        materialContent:
          "Перед выходом на высоту сотрудник обязан проверить страховочную систему, точку анкерного крепления, маршрут доступа и наличие действующего допуска.",
        materialFileName: "work-at-height-checklist.pdf",
        materialFileUrl: "https://example.com/training/work-at-height-checklist.pdf",
        videoUrl: "https://example.com/training/work-at-height-video",
        issuerName: "Stroy Company 2030 HSE Academy",
        requiresExam: true,
        createsDocument: true,
        createsSafetyCertificate: true,
      },
      include: {
        exam: true,
      },
    });
  }

  const existingActiveAssignment = await prisma.trainingAssignment.findFirst({
    where: {
      employeeId: employee.id,
      trainingProgramId: assignedTrainingProgram.id,
    },
  });

  if (!existingActiveAssignment) {
    await prisma.trainingAssignment.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        trainingProgramId: assignedTrainingProgram.id,
        assignedByUserId: assigner.id,
        dueAt: twoWeeksAhead,
        status: "ASSIGNED",
        progressPercent: 0,
      },
    });
  }

  if (!assignedTrainingProgram.exam) {
    await prisma.exam.create({
      data: {
        companyId: user.companyId,
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
  }

  console.log("Demo-данные для расширенного кабинета сотрудника подготовлены.");
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
