import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  type DocumentKind,
  type ScopeType,
  createComplianceDocumentTypeSchema,
  createApprovalRouteSchema,
  createApprovalStepSchema,
  createArchiveRecordSchema,
  createAttachmentSchema,
  createBranchSchema,
  createCertificateMetadataSchema,
  createDocumentEnvelopeSchema,
  createDocumentTemplateSchema,
  createDocumentVersionSchema,
  createExportSnapshotSchema,
  createOrganizationSchema,
  createPositionSchema,
  createRetentionPolicySchema,
  createScopeGrantSchema,
  createSignatureSchema,
  createSignatureVerificationSchema,
  createWorkSiteSchema,
  createAdmissionCheckSchema,
  closePermitSchema,
  contractorAccessActListFilterSchema,
  contractorAccessActReasonSchema,
  contractorAccessActWorkflowSchema,
  createContractorAccessActSchema,
  createPermitSchema,
  createPpeIssueRecordSchema,
  permitListFilterSchema,
  permitReasonSchema,
  permitWorkflowSchema,
  preparePermitSignSchema,
  updateContractorAccessActSchema,
  updatePermitSchema,
} from "@dsj/types";
import type { Response } from "express";
import {
  createClearanceTypeSchema,
  createContractorOrganizationSchema,
  createContractorWorkerSchema,
  createJobRequirementMatrixSchema,
  createJobRequirementMatrixVersionSchema,
  createOrderSchema,
  createOrderVersionSchema,
  createQualificationDocumentSchema,
  createTrainingPlanSchema,
  createTrainingPlanVersionSchema,
  createBriefingJournalSchema,
  createBriefingJournalEntrySchema,
  createTrainingTypeSchema,
} from "./core-platform.contracts";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CorePlatformService } from "./core-platform.service";
import { ContractorAccessActsService } from "./contractor-access-acts.service";
import { WorkPermitsService } from "./work-permits.service";

const adminRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "SAFETY_ENGINEER"] as const;
const signerRoles = [...adminRoles, "EMPLOYEE_SIGNER"] as const;

type OrganizationQuery = {
  organizationId?: string;
  companyId?: string;
};

@Controller("core-platform")
export class CorePlatformController {
  constructor(
    private readonly corePlatformService: CorePlatformService,
    private readonly contractorAccessActsService: ContractorAccessActsService,
    private readonly workPermitsService: WorkPermitsService,
  ) {}

  private resolveOrganizationId(query?: OrganizationQuery) {
    return query?.organizationId ?? query?.companyId;
  }

  @Get("organizations")
  @Roles(...signerRoles)
  listOrganizations(@CurrentUser() user: AuthenticatedUser) {
    return this.corePlatformService.listOrganizations(user);
  }

  @Post("organizations")
  @Roles(...adminRoles)
  createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrganizationSchema))
    input: Parameters<CorePlatformService["createOrganization"]>[1],
  ) {
    return this.corePlatformService.createOrganization(user, input);
  }

  @Get("branches")
  @Roles(...signerRoles)
  listBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listBranches(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("branches")
  @Roles(...adminRoles)
  createBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBranchSchema))
    input: Parameters<CorePlatformService["createBranch"]>[1],
  ) {
    return this.corePlatformService.createBranch(user, input);
  }

  @Get("work-sites")
  @Roles(...signerRoles)
  listWorkSites(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listWorkSites(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("work-sites")
  @Roles(...adminRoles)
  createWorkSite(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWorkSiteSchema))
    input: Parameters<CorePlatformService["createWorkSite"]>[1],
  ) {
    return this.corePlatformService.createWorkSite(user, input);
  }

  @Get("positions")
  @Roles(...signerRoles)
  listPositions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listPositions(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("positions")
  @Roles(...adminRoles)
  createPosition(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPositionSchema))
    input: Parameters<CorePlatformService["createPosition"]>[1],
  ) {
    return this.corePlatformService.createPosition(user, input);
  }

  @Get("contractor-organizations")
  @Roles(...signerRoles)
  listContractorOrganizations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listContractorOrganizations(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("contractor-organizations")
  @Roles(...adminRoles)
  createContractorOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createContractorOrganizationSchema))
    input: Parameters<CorePlatformService["createContractorOrganization"]>[1],
  ) {
    return this.corePlatformService.createContractorOrganization(user, input);
  }

  @Get("contractor-workers")
  @Roles(...signerRoles)
  listContractorWorkers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listContractorWorkers(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("contractor-workers")
  @Roles(...adminRoles)
  createContractorWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createContractorWorkerSchema))
    input: Parameters<CorePlatformService["createContractorWorker"]>[1],
  ) {
    return this.corePlatformService.createContractorWorker(user, input);
  }

  @Get("scope-grants")
  @Roles(...adminRoles)
  listScopeGrants(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listScopeGrants(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("scope-grants")
  @Roles(...adminRoles)
  createScopeGrant(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createScopeGrantSchema))
    input: Parameters<CorePlatformService["createScopeGrant"]>[1],
  ) {
    return this.corePlatformService.createScopeGrant(user, input);
  }

  @Get("clearance-types")
  @Roles(...signerRoles)
  listClearanceTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listClearanceTypes(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("clearance-types")
  @Roles(...adminRoles)
  createClearanceType(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createClearanceTypeSchema))
    input: Parameters<CorePlatformService["createClearanceType"]>[1],
  ) {
    return this.corePlatformService.createClearanceType(user, input);
  }

  @Get("training-types")
  @Roles(...signerRoles)
  listTrainingTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listTrainingTypes(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("training-types")
  @Roles(...adminRoles)
  createTrainingType(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTrainingTypeSchema))
    input: Parameters<CorePlatformService["createTrainingType"]>[1],
  ) {
    return this.corePlatformService.createTrainingType(user, input);
  }

  @Get("document-types")
  @Roles(...signerRoles)
  listComplianceDocumentTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listComplianceDocumentTypes(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("document-types")
  @Roles(...adminRoles)
  createComplianceDocumentType(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createComplianceDocumentTypeSchema))
    input: Parameters<CorePlatformService["createComplianceDocumentType"]>[1],
  ) {
    return this.corePlatformService.createComplianceDocumentType(user, input);
  }

  @Get("job-requirement-matrices")
  @Roles(...signerRoles)
  listJobRequirementMatrices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listJobRequirementMatrices(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("job-requirement-matrices")
  @Roles(...adminRoles)
  createJobRequirementMatrix(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createJobRequirementMatrixSchema))
    input: Parameters<CorePlatformService["createJobRequirementMatrix"]>[1],
  ) {
    return this.corePlatformService.createJobRequirementMatrix(user, input);
  }

  @Post("job-requirement-matrix-versions")
  @Roles(...adminRoles)
  createJobRequirementMatrixVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createJobRequirementMatrixVersionSchema))
    input: Parameters<
      CorePlatformService["createJobRequirementMatrixVersion"]
    >[1],
  ) {
    return this.corePlatformService.createJobRequirementMatrixVersion(
      user,
      input,
    );
  }

  @Get("training-plans")
  @Roles(...signerRoles)
  listTrainingPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listTrainingPlans(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("training-plans")
  @Roles(...adminRoles)
  createTrainingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTrainingPlanSchema))
    input: Parameters<CorePlatformService["createTrainingPlan"]>[1],
  ) {
    return this.corePlatformService.createTrainingPlan(user, input);
  }

  @Post("training-plan-versions")
  @Roles(...adminRoles)
  createTrainingPlanVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTrainingPlanVersionSchema))
    input: Parameters<CorePlatformService["createTrainingPlanVersion"]>[1],
  ) {
    return this.corePlatformService.createTrainingPlanVersion(user, input);
  }

  @Post("training-plans/:trainingPlanId/approve")
  @Roles(...adminRoles)
  approveTrainingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("trainingPlanId") trainingPlanId: string,
  ) {
    return this.corePlatformService.approveTrainingPlan(user, trainingPlanId);
  }

  @Get("orders")
  @Roles(...signerRoles)
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listOrders(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("orders")
  @Roles(...adminRoles)
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderSchema))
    input: Parameters<CorePlatformService["createOrder"]>[1],
  ) {
    return this.corePlatformService.createOrder(user, input);
  }

  @Post("order-versions")
  @Roles(...adminRoles)
  createOrderVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrderVersionSchema))
    input: Parameters<CorePlatformService["createOrderVersion"]>[1],
  ) {
    return this.corePlatformService.createOrderVersion(user, input);
  }

  @Post("orders/:orderId/approve")
  @Roles(...adminRoles)
  approveOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.corePlatformService.approveOrder(user, orderId);
  }

  @Post("orders/:orderId/sign")
  @Roles(...signerRoles)
  signOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body(new ZodValidationPipe(createSignatureSchema))
    input: Parameters<CorePlatformService["signOrder"]>[2],
  ) {
    return this.corePlatformService.signOrder(user, orderId, input);
  }

  @Post("orders/:orderId/annul")
  @Roles(...adminRoles)
  annulOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
  ) {
    return this.corePlatformService.annulOrder(user, orderId);
  }

  @Get("briefing-journals")
  @Roles(...signerRoles)
  listBriefingJournals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listBriefingJournals(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("briefing-journals")
  @Roles(...adminRoles)
  createBriefingJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBriefingJournalSchema))
    input: Parameters<CorePlatformService["createBriefingJournal"]>[1],
  ) {
    return this.corePlatformService.createBriefingJournal(user, input);
  }

  @Post("briefing-journal-entries")
  @Roles(...adminRoles)
  createBriefingJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBriefingJournalEntrySchema))
    input: Parameters<CorePlatformService["createBriefingJournalEntry"]>[1],
  ) {
    return this.corePlatformService.createBriefingJournalEntry(user, input);
  }

  @Get("briefing-journal-entries")
  @Roles(...signerRoles)
  listBriefingJournalEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listBriefingJournalEntries(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("briefing-journal-entries/:entryId/open")
  @Roles(...signerRoles)
  openBriefingJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entryId") entryId: string,
  ) {
    return this.corePlatformService.openBriefingJournalEntry(user, entryId);
  }

  @Post("briefing-journal-entries/:entryId/acknowledge")
  @Roles(...signerRoles)
  acknowledgeBriefingJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entryId") entryId: string,
  ) {
    return this.corePlatformService.acknowledgeBriefingJournalEntry(
      user,
      entryId,
    );
  }

  @Post("briefing-journal-entries/:entryId/sign")
  @Roles(...signerRoles)
  signBriefingJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entryId") entryId: string,
    @Body(new ZodValidationPipe(createSignatureSchema))
    input: Parameters<CorePlatformService["signBriefingJournalEntry"]>[2],
  ) {
    return this.corePlatformService.signBriefingJournalEntry(
      user,
      entryId,
      input,
    );
  }

  @Post("briefing-journal-entries/:entryId/archive")
  @Roles(...adminRoles)
  archiveBriefingJournalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("entryId") entryId: string,
  ) {
    return this.corePlatformService.archiveBriefingJournalEntry(user, entryId);
  }

  @Get("document-templates")
  @Roles(...signerRoles)
  listDocumentTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listDocumentTemplates(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("document-templates")
  @Roles(...adminRoles)
  createDocumentTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createDocumentTemplateSchema))
    input: Parameters<CorePlatformService["createDocumentTemplate"]>[1],
  ) {
    return this.corePlatformService.createDocumentTemplate(user, input);
  }

  @Get("approval-routes")
  @Roles(...signerRoles)
  listApprovalRoutes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listApprovalRoutes(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("approval-routes")
  @Roles(...adminRoles)
  createApprovalRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApprovalRouteSchema))
    input: Parameters<CorePlatformService["createApprovalRoute"]>[1],
  ) {
    return this.corePlatformService.createApprovalRoute(user, input);
  }

  @Post("approval-steps")
  @Roles(...adminRoles)
  createApprovalStep(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApprovalStepSchema))
    input: Parameters<CorePlatformService["createApprovalStep"]>[1],
  ) {
    return this.corePlatformService.createApprovalStep(user, input);
  }

  @Get("document-envelopes")
  @Roles(...signerRoles)
  listDocumentEnvelopes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listDocumentEnvelopes(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Get("document-envelopes/:envelopeId/evidence-package")
  @Roles(...signerRoles)
  buildEvidencePackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("envelopeId") envelopeId: string,
  ) {
    return this.corePlatformService.buildEvidencePackage(user, envelopeId);
  }

  @Post("document-envelopes")
  @Roles(...adminRoles)
  createDocumentEnvelope(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createDocumentEnvelopeSchema))
    input: Parameters<CorePlatformService["createDocumentEnvelope"]>[1],
  ) {
    return this.corePlatformService.createDocumentEnvelope(user, input);
  }

  @Post("document-versions")
  @Roles(...adminRoles)
  createDocumentVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createDocumentVersionSchema))
    input: Parameters<CorePlatformService["createDocumentVersion"]>[1],
  ) {
    return this.corePlatformService.createDocumentVersion(user, input);
  }

  @Get("certificate-metadata")
  @Roles(...signerRoles)
  listCertificateMetadata(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listCertificateMetadata(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("certificate-metadata")
  @Roles(...adminRoles)
  createCertificateMetadata(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCertificateMetadataSchema))
    input: Parameters<CorePlatformService["createCertificateMetadata"]>[1],
  ) {
    return this.corePlatformService.createCertificateMetadata(user, input);
  }

  @Post("signatures")
  @Roles(...signerRoles)
  createSignature(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSignatureSchema))
    input: Parameters<CorePlatformService["createSignature"]>[1],
  ) {
    return this.corePlatformService.createSignature(user, input);
  }

  @Post("signatures/verification")
  @Roles(...adminRoles)
  createSignatureVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSignatureVerificationSchema))
    input: Parameters<CorePlatformService["createSignatureVerification"]>[1],
  ) {
    return this.corePlatformService.createSignatureVerification(user, input);
  }

  @Post("attachments")
  @Roles(...signerRoles)
  createAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAttachmentSchema))
    input: Parameters<CorePlatformService["createAttachment"]>[1],
  ) {
    return this.corePlatformService.createAttachment(user, input);
  }

  @Post("export-snapshots")
  @Roles(...signerRoles)
  createExportSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createExportSnapshotSchema))
    input: Parameters<CorePlatformService["createExportSnapshot"]>[1],
  ) {
    return this.corePlatformService.createExportSnapshot(user, input);
  }

  @Get("retention-policies")
  @Roles(...signerRoles)
  listRetentionPolicies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listRetentionPolicies(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Get("retention-policies/resolve")
  @Roles(...signerRoles)
  resolveRetentionPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: OrganizationQuery & {
      documentKind: DocumentKind;
      scopeType: ScopeType;
      effectiveAt?: string;
    },
  ) {
    return this.corePlatformService.resolveRetentionPolicy(user, {
      organizationId: this.resolveOrganizationId(query),
      documentKind: query.documentKind,
      scopeType: query.scopeType,
      effectiveAt: query.effectiveAt ?? null,
    });
  }

  @Post("retention-policies")
  @Roles(...adminRoles)
  createRetentionPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRetentionPolicySchema))
    input: Parameters<CorePlatformService["createRetentionPolicy"]>[1],
  ) {
    return this.corePlatformService.createRetentionPolicy(user, input);
  }

  @Get("archive-records")
  @Roles(...signerRoles)
  listArchiveRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listArchiveRecords(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("archive-records")
  @Roles(...adminRoles)
  createArchiveRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createArchiveRecordSchema))
    input: Parameters<CorePlatformService["createArchiveRecord"]>[1],
  ) {
    return this.corePlatformService.createArchiveRecord(user, input);
  }

  @Get("contractor-access-acts")
  @Roles(...signerRoles)
  listContractorAccessActs(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(contractorAccessActListFilterSchema))
    query: Parameters<ContractorAccessActsService["list"]>[1],
  ) {
    return this.contractorAccessActsService.list(user, query);
  }

  @Get("contractor-access-acts/:actId")
  @Roles(...signerRoles)
  getContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
  ) {
    return this.contractorAccessActsService.get(user, actId);
  }

  @Post("contractor-access-acts")
  @Roles(...adminRoles)
  createContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createContractorAccessActSchema))
    input: Parameters<ContractorAccessActsService["create"]>[1],
  ) {
    return this.contractorAccessActsService.create(user, input);
  }

  @Patch("contractor-access-acts/:actId")
  @Roles(...adminRoles)
  updateContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
    @Body(new ZodValidationPipe(updateContractorAccessActSchema))
    input: Parameters<ContractorAccessActsService["update"]>[2],
  ) {
    return this.contractorAccessActsService.update(user, actId, input);
  }

  @Post("contractor-access-acts/:actId/activate")
  @Roles(...adminRoles)
  activateContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
    @Body(new ZodValidationPipe(contractorAccessActWorkflowSchema))
    input: Parameters<ContractorAccessActsService["activate"]>[2],
  ) {
    return this.contractorAccessActsService.activate(user, actId, input);
  }

  @Post("contractor-access-acts/:actId/close")
  @Roles(...adminRoles)
  closeContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
    @Body(new ZodValidationPipe(contractorAccessActWorkflowSchema))
    input: Parameters<ContractorAccessActsService["close"]>[2],
  ) {
    return this.contractorAccessActsService.close(user, actId, input);
  }

  @Post("contractor-access-acts/:actId/cancel")
  @Roles(...adminRoles)
  cancelContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
    @Body(new ZodValidationPipe(contractorAccessActReasonSchema))
    input: Parameters<ContractorAccessActsService["cancel"]>[2],
  ) {
    return this.contractorAccessActsService.cancel(user, actId, input);
  }

  @Post("contractor-access-acts/:actId/archive")
  @Roles(...adminRoles)
  archiveContractorAccessAct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("actId") actId: string,
  ) {
    return this.contractorAccessActsService.archive(user, actId);
  }

  @Get("work-permits")
  @Roles(...signerRoles)
  listWorkPermits(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(permitListFilterSchema))
    query: Parameters<WorkPermitsService["list"]>[1],
  ) {
    return this.workPermitsService.list(user, query);
  }

  @Get("work-permits/journal/pdf")
  @Roles(...signerRoles)
  async workPermitJournalPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(permitListFilterSchema))
    query: Parameters<WorkPermitsService["downloadJournal"]>[1],
    @Res() response: Response,
  ) {
    const buffer = await this.workPermitsService.downloadJournal(user, query);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="work-permit-journal.pdf"',
    );
    response.send(buffer);
  }

  @Get("work-permits/:permitId")
  @Roles(...signerRoles)
  getWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
  ) {
    return this.workPermitsService.get(user, permitId);
  }

  @Post("work-permits")
  @Roles(...adminRoles)
  createWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPermitSchema))
    input: Parameters<WorkPermitsService["create"]>[1],
  ) {
    return this.workPermitsService.create(user, input);
  }

  @Patch("work-permits/:permitId")
  @Roles(...adminRoles)
  updateWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(updatePermitSchema))
    input: Parameters<WorkPermitsService["update"]>[2],
  ) {
    return this.workPermitsService.update(user, permitId, input);
  }

  @Get("ppe-issues")
  @Roles(...adminRoles)
  listPpeIssues(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.workPermitsService.listPpe(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("ppe-issues")
  @Roles(...adminRoles)
  createPpeIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPpeIssueRecordSchema))
    input: Parameters<WorkPermitsService["createPpe"]>[1],
  ) {
    return this.workPermitsService.createPpe(user, input);
  }

  @Post("work-permits/:permitId/precheck")
  @Roles(...adminRoles)
  runWorkPermitPrecheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
  ) {
    return this.workPermitsService.precheck(user, permitId);
  }

  @Post("work-permits/:permitId/submit")
  @Roles(...adminRoles)
  submitWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitWorkflowSchema))
    input: Parameters<WorkPermitsService["submit"]>[2],
  ) {
    return this.workPermitsService.submit(user, permitId, input);
  }

  @Post("work-permits/:permitId/confirm")
  @Roles(...signerRoles)
  confirmWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitWorkflowSchema))
    input: Parameters<WorkPermitsService["confirm"]>[2],
  ) {
    return this.workPermitsService.confirm(user, permitId, input);
  }

  @Post("work-permits/:permitId/approve")
  @Roles(...signerRoles)
  approveWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitWorkflowSchema))
    input: Parameters<WorkPermitsService["approve"]>[2],
  ) {
    return this.workPermitsService.approve(user, permitId, input);
  }

  @Post("work-permits/:permitId/reject")
  @Roles(...signerRoles)
  rejectWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitReasonSchema))
    input: Parameters<WorkPermitsService["reject"]>[2],
  ) {
    return this.workPermitsService.reject(user, permitId, input);
  }

  @Post("work-permits/:permitId/prepare-sign")
  @Roles(...signerRoles)
  prepareWorkPermitSign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(preparePermitSignSchema))
    input: Parameters<WorkPermitsService["prepareSign"]>[2],
  ) {
    return this.workPermitsService.prepareSign(user, permitId, input);
  }

  @Post("work-permits/:permitId/activate")
  @Roles(...signerRoles)
  activateWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitWorkflowSchema))
    input: Parameters<WorkPermitsService["activate"]>[2],
  ) {
    return this.workPermitsService.activate(user, permitId, input);
  }

  @Post("work-permits/:permitId/suspend")
  @Roles(...adminRoles)
  suspendWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitReasonSchema))
    input: Parameters<WorkPermitsService["suspend"]>[2],
  ) {
    return this.workPermitsService.suspend(user, permitId, input);
  }

  @Post("work-permits/:permitId/resume")
  @Roles(...adminRoles)
  resumeWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitWorkflowSchema))
    input: Parameters<WorkPermitsService["resume"]>[2],
  ) {
    return this.workPermitsService.resume(user, permitId, input);
  }

  @Post("work-permits/:permitId/close")
  @Roles(...signerRoles)
  closeWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(closePermitSchema))
    input: Parameters<WorkPermitsService["close"]>[2],
  ) {
    return this.workPermitsService.close(user, permitId, input);
  }

  @Post("work-permits/:permitId/cancel")
  @Roles(...adminRoles)
  cancelWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Body(new ZodValidationPipe(permitReasonSchema))
    input: Parameters<WorkPermitsService["cancel"]>[2],
  ) {
    return this.workPermitsService.cancel(user, permitId, input);
  }

  @Post("work-permits/:permitId/archive")
  @Roles(...adminRoles)
  archiveWorkPermit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
  ) {
    return this.workPermitsService.archive(user, permitId);
  }

  @Get("work-permits/:permitId/evidence")
  @Roles(...signerRoles)
  workPermitEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
  ) {
    return this.workPermitsService.evidence(user, permitId);
  }

  @Get("work-permits/:permitId/pdf")
  @Roles(...signerRoles)
  async workPermitPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param("permitId") permitId: string,
    @Res() response: Response,
  ) {
    const buffer = await this.workPermitsService.download(user, permitId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="work-permit-${permitId}.pdf"`,
    );
    response.send(buffer);
  }

  @Get("qualification-documents")
  @Roles(...signerRoles)
  listQualificationDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listQualificationDocuments(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("qualification-documents")
  @Roles(...adminRoles)
  createQualificationDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createQualificationDocumentSchema))
    input: Parameters<CorePlatformService["createQualificationDocument"]>[1],
  ) {
    return this.corePlatformService.createQualificationDocument(user, input);
  }

  @Get("admission/evaluations")
  @Roles(...signerRoles)
  listAdmissionEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQuery,
  ) {
    return this.corePlatformService.listAdmissionEvaluations(
      user,
      this.resolveOrganizationId(query),
    );
  }

  @Post("admission/checks")
  @Roles(...signerRoles)
  checkAdmission(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createAdmissionCheckSchema))
    input: Parameters<CorePlatformService["checkAdmission"]>[1],
  ) {
    return this.corePlatformService.checkAdmission(user, input);
  }

  @Get("admission/evaluations/:id")
  @Roles(...signerRoles)
  getAdmissionEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.corePlatformService.getAdmissionEvaluation(user, id);
  }
}
