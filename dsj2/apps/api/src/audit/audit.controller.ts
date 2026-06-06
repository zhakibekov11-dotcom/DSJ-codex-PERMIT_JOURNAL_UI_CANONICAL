import { Controller, Get, ParseIntPipe, Query } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { getCompanyScope } from "../common/utils/tenant-scope";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles("SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 30,
    @Query("entityType") entityType?: string,
    @Query("companyId") companyId?: string,
  ) {
    return this.auditService.list(getCompanyScope(user, companyId) ?? null, limit, entityType);
  }
}
