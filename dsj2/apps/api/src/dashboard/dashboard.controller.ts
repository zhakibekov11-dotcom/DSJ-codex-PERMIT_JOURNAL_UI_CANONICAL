import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("companyId") companyId?: string,
  ) {
    return this.dashboardService.summary(user, companyId);
  }
}
