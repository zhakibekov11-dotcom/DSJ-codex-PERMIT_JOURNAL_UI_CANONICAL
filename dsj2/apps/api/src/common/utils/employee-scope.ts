import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../types/authenticated-user.type";

export async function requireEmployeeScope(
  prisma: PrismaService,
  user: AuthenticatedUser,
) {
  if (user.role !== "EMPLOYEE_SIGNER") {
    throw new ForbiddenException("Действие доступно только сотруднику.");
  }

  const employee = await prisma.employee.findFirst({
    where: {
      userId: user.userId,
      isArchived: false,
    },
  });

  if (!employee) {
    throw new ForbiddenException("Личный кабинет не привязан к карточке сотрудника.");
  }

  return employee;
}
