import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { loginSchema } from "@dsj/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(@Body(new ZodValidationPipe(loginSchema)) input: { email: string; password: string }) {
    return this.authService.login(input.email, input.password);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }
}
