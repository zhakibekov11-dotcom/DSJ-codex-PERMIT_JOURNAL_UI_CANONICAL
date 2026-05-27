import { z } from "zod";
import {
  briefingJournalKindSchema,
  briefingJournalEntryStatusSchema,
  briefingJournalStatusSchema,
  briefingParticipantStatusSchema,
  briefingTypeSchema,
  matrixStatusSchema,
  matrixVersionStatusSchema,
  orderStatusSchema,
  orderVersionStatusSchema,
  qualificationDocumentKindSchema,
  qualificationDocumentStatusSchema,
  scopeTypeSchema,
  trainingPlanStatusSchema,
  trainingPlanVersionStatusSchema,
  workPermitStatusSchema,
  workPermitTypeSchema,
  workPermitVersionStatusSchema,
} from "@dsj/types";

const jsonValueSchema: z.ZodType<unknown> = z.unknown();
const isoStringSchema = z.string().min(1);

export const createContractorOrganizationSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  bin: z.string().max(64).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createContractorWorkerSchema = z.object({
  organizationId: z.string().optional(),
  contractorOrganizationId: z.string(),
  fullName: z.string().min(2).max(255),
  iin: z.string().min(12).max(12),
  workerNumber: z.string().min(2).max(64),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  positionTitle: z.string().max(255).nullable().optional(),
  employeeKind: z.literal("CONTRACTOR").default("CONTRACTOR"),
  status: z.enum(["active", "inactive"]).default("active"),
  isArchived: z.boolean().default(false),
});

export const createClearanceTypeSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createTrainingTypeSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  requiresExam: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const createJobRequirementMatrixSchema = z.object({
  organizationId: z.string().optional(),
  positionId: z.string().nullable().optional(),
  matrixCode: z.string().min(2).max(64),
  status: matrixStatusSchema.default("DRAFT"),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createJobRequirementMatrixVersionSchema = z.object({
  matrixId: z.string(),
  versionNo: z.number().int().positive().optional(),
  status: matrixVersionStatusSchema.default("DRAFT"),
  payloadJson: jsonValueSchema,
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createTrainingPlanSchema = z.object({
  organizationId: z.string().optional(),
  planCode: z.string().min(2).max(64),
  title: z.string().min(2).max(255),
  description: z.string().max(2000).nullable().optional(),
  positionId: z.string().nullable().optional(),
  matrixVersionId: z.string().nullable().optional(),
  status: trainingPlanStatusSchema.default("DRAFT"),
  requiresExam: z.boolean().default(false),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createTrainingPlanVersionSchema = z.object({
  trainingPlanId: z.string(),
  versionNo: z.number().int().positive().optional(),
  status: trainingPlanVersionStatusSchema.default("DRAFT"),
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
});

export const createOrderSchema = z.object({
  organizationId: z.string().optional(),
  orderCode: z.string().min(2).max(64),
  orderType: z.string().min(2).max(120),
  subject: z.string().min(2).max(255),
  basisDocumentId: z.string().nullable().optional(),
  status: orderStatusSchema.default("DRAFT"),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createOrderVersionSchema = z.object({
  orderId: z.string(),
  versionNo: z.number().int().positive().optional(),
  status: orderVersionStatusSchema.default("DRAFT"),
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
});

export const createResponsibleAssignmentSchema = z.object({
  organizationId: z.string().optional(),
  orderVersionId: z.string(),
  responsibleType: z.enum(["EMPLOYEE", "CONTRACTOR_WORKER", "ROLE"]),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  roleCode: z.string().nullable().optional(),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createBriefingJournalSchema = z.object({
  organizationId: z.string().optional(),
  journalCode: z.string().min(2).max(64),
  title: z.string().min(2).max(255),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: briefingJournalStatusSchema.default("DRAFT"),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createBriefingJournalEntrySchema = z.object({
  journalId: z.string(),
  organizationId: z.string().optional(),
  entryNo: z.number().int().positive().optional(),
  registrationNo: z.string().nullable().optional(),
  journalKind: briefingJournalKindSchema,
  employeeId: z.string(),
  instructorUserId: z.string(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  briefingType: briefingTypeSchema,
  status: briefingJournalEntryStatusSchema.default("DRAFT"),
  employeeStatus: briefingParticipantStatusSchema.default("ASSIGNED"),
  briefingDate: isoStringSchema,
  briefingTime: z.string().nullable().optional(),
  topic: z.string().min(3),
  program: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  unscheduledReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  openedAt: z.string().nullable().optional(),
  acknowledgedAt: z.string().nullable().optional(),
  signedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  finalSignedAt: z.string().nullable().optional(),
  documentHash: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  archiveRecordId: z.string().nullable().optional(),
  retentionPolicyId: z.string().nullable().optional(),
  replacesEntryId: z.string().nullable().optional(),
  annulReason: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  updatedByUserId: z.string().nullable().optional(),
});

export const createWorkPermitSchema = z.object({
  organizationId: z.string().optional(),
  permitCode: z.string().min(2).max(64),
  permitType: workPermitTypeSchema,
  title: z.string().min(2).max(255),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: workPermitStatusSchema.default("DRAFT"),
  currentVersionId: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const createWorkPermitVersionSchema = z.object({
  permitId: z.string(),
  versionNo: z.number().int().positive().optional(),
  status: workPermitVersionStatusSchema.default("DRAFT"),
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
});

export const updateWorkPermitSchema = z.object({
  permitCode: z.string().min(2).max(64).optional(),
  permitType: workPermitTypeSchema.optional(),
  title: z.string().min(2).max(255).optional(),
  scopeType: scopeTypeSchema.optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  payloadJson: jsonValueSchema.optional(),
});

export const workPermitPrecheckSchema = z.object({
  payloadJson: jsonValueSchema.optional(),
}).default({});

export const workPermitWorkflowSchema = z.object({
  comment: z.string().max(2000).nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  closure: jsonValueSchema.optional(),
}).default({});

export const createBrigadeSchema = z.object({
  permitId: z.string(),
  brigadeCode: z.string().min(2).max(64),
  title: z.string().min(2).max(255),
  leaderEmployeeId: z.string().nullable().optional(),
});

export const createBrigadeMemberSchema = z.object({
  brigadeId: z.string(),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  roleCode: z.string().min(1).max(120),
  status: z.enum(["ASSIGNED", "READY", "SIGNED", "REJECTED"]).default("ASSIGNED"),
});

export const createQualificationDocumentSchema = z.object({
  organizationId: z.string().optional(),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  clearanceTypeId: z.string().nullable().optional(),
  trainingTypeId: z.string().nullable().optional(),
  documentKind: qualificationDocumentKindSchema,
  documentNumber: z.string().min(2).max(120),
  issueDate: isoStringSchema,
  expiryDate: z.string().nullable().optional(),
  status: qualificationDocumentStatusSchema.default("DRAFT"),
  documentEnvelopeId: z.string().nullable().optional(),
});

export type CreateJobRequirementMatrixInput = z.infer<
  typeof createJobRequirementMatrixSchema
>;
export type CreateContractorOrganizationInput = z.infer<
  typeof createContractorOrganizationSchema
>;
export type CreateContractorWorkerInput = z.infer<
  typeof createContractorWorkerSchema
>;
export type CreateClearanceTypeInput = z.infer<typeof createClearanceTypeSchema>;
export type CreateTrainingTypeInput = z.infer<typeof createTrainingTypeSchema>;
export type CreateJobRequirementMatrixVersionInput = z.infer<
  typeof createJobRequirementMatrixVersionSchema
>;
export type CreateTrainingPlanInput = z.infer<typeof createTrainingPlanSchema>;
export type CreateTrainingPlanVersionInput = z.infer<
  typeof createTrainingPlanVersionSchema
>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateOrderVersionInput = z.infer<typeof createOrderVersionSchema>;
export type CreateResponsibleAssignmentInput = z.infer<
  typeof createResponsibleAssignmentSchema
>;
export type CreateBriefingJournalInput = z.infer<typeof createBriefingJournalSchema>;
export type CreateBriefingJournalEntryInput = z.infer<
  typeof createBriefingJournalEntrySchema
>;
export type CreateWorkPermitInput = z.infer<typeof createWorkPermitSchema>;
export type CreateWorkPermitVersionInput = z.infer<
  typeof createWorkPermitVersionSchema
>;
export type UpdateWorkPermitInput = z.infer<typeof updateWorkPermitSchema>;
export type WorkPermitPrecheckInput = z.infer<typeof workPermitPrecheckSchema>;
export type WorkPermitWorkflowInput = z.infer<typeof workPermitWorkflowSchema>;
export type CreateBrigadeInput = z.infer<typeof createBrigadeSchema>;
export type CreateBrigadeMemberInput = z.infer<typeof createBrigadeMemberSchema>;
export type CreateQualificationDocumentInput = z.infer<
  typeof createQualificationDocumentSchema
>;
