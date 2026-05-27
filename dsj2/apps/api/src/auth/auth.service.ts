import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async hasLinkedEmployeeRecord(userId: string, role: string) {
    if (role !== "EMPLOYEE_SIGNER") {
      return true;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        userId,
        isArchived: false,
      },
      select: {
        id: true,
      },
    });

    return Boolean(employee);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        company: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Неверный email или пароль.");
    }

    const isValid = await compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException("Неверный email или пароль.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const hasLinkedEmployeeRecord = await this.hasLinkedEmployeeRecord(user.id, user.role);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    return {
      accessToken,
      expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") ?? "8h",
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyName: user.company?.name ?? null,
        hasLinkedEmployeeRecord,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        department: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Сессия недействительна.");
    }

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      company: user.company
        ? {
            name: user.company.name,
          }
        : null,
      department: user.department
        ? {
            name: user.department.name,
          }
        : null,
      hasLinkedEmployeeRecord: await this.hasLinkedEmployeeRecord(user.id, user.role),
    };
  }
}
