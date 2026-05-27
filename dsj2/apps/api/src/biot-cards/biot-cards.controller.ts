import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  biotCardDefaultsQuerySchema,
  cardGenerationRequestQuerySchema,
  generateBiotCardBatchSchema,
  generateBiotCardSchema,
  updateCardGenerationRequestSchema,
} from "@dsj/types";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { BiotCardsService } from "./biot-cards.service";

@Controller("biot-cards")
export class BiotCardsController {
  constructor(private readonly biotCardsService: BiotCardsService) {}

  @Get("defaults")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async getDefaults(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(biotCardDefaultsQuerySchema))
    query: Parameters<BiotCardsService["getDefaults"]>[1],
  ) {
    return this.biotCardsService.getDefaults(user, query);
  }

  @Post("generate")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(generateBiotCardSchema))
    input: Parameters<BiotCardsService["generate"]>[1],
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.generate(user, input);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    if ("requestId" in result && result.requestId) {
      response.setHeader("X-Card-Request-Id", result.requestId);
    }
    response.send(result.buffer);
  }

  @Post("generate-batch")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async generateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(generateBiotCardBatchSchema))
    input: Parameters<BiotCardsService["generateBatch"]>[1],
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.generateBatch(user, input);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    if ("requestId" in result && result.requestId) {
      response.setHeader("X-Card-Request-Id", result.requestId);
    }
    response.send(result.buffer);
  }

  @Get("requests")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(cardGenerationRequestQuerySchema))
    query: Parameters<BiotCardsService["listRequests"]>[1],
  ) {
    return this.biotCardsService.listRequests(user, query);
  }

  @Get("requests/:id")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async getRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(cardGenerationRequestQuerySchema))
    query: Parameters<BiotCardsService["getRequest"]>[2],
  ) {
    return this.biotCardsService.getRequest(user, id, query);
  }

  @Post("requests/:id/update")
  @Roles("COMPANY_ADMIN")
  async updateRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCardGenerationRequestSchema))
    input: Parameters<BiotCardsService["updateRequest"]>[2],
  ) {
    return this.biotCardsService.updateRequest(user, id, input);
  }

  @Delete("requests/:id")
  @Roles("COMPANY_ADMIN")
  async deleteRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(cardGenerationRequestQuerySchema))
    query: Parameters<BiotCardsService["deleteRequest"]>[2],
  ) {
    return this.biotCardsService.deleteRequest(user, id, query);
  }

  @Get("requests/:id/export-registry")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async exportRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.exportRequestRegistry(user, id);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }

  @Get("requests/:id/export-cards")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async exportCards(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.exportRequestCards(user, id);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }

  @Get("requests/:id/export-protocol")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async exportProtocol(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.exportRequestProtocol(user, id);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }

  @Get("requests/:id/export-witness")
  @Roles("COMPANY_ADMIN", "SAFETY_ENGINEER")
  async exportWitness(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const result = await this.biotCardsService.exportRequestWitness(user, id);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }
}
