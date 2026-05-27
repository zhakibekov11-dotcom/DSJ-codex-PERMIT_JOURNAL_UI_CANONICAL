import { Controller, Get, Query } from "@nestjs/common";
import type { UserRole } from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("role") role?: UserRole,
    @Query("companyId") companyId?: string,
  ) {
    return this.usersService.list(user, role, companyId);
  }
}
