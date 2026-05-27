import { z } from "zod";
import { briefingJournalKindSchema, briefingTypeSchema } from "./briefing";
import { scopeTypeSchema } from "./core-identity";

const jsonValueSchema: z.ZodType<unknown> = z.unknown();
const isoStringSchema = z.string().min(1);

export const admissionSubjectTypeSchema = z.enum([
  "EMPLOYEE",
  "CONTRACTOR_WORKER",
]);

export const admissionStatusSchema = z.enum([
  "DOPUSHEN",
  "OGRANICHENNO_DOPUSHEN",
  "NE_DOPUSHEN",
]);

export const admissionSeveritySchema = z.enum([
  "BLOCKER",
  "WARNING",
]);

export const workPermitTypeSchema = z.enum([
  "HOT_WORK",
  "CONFINED_SPACE",
  "ELECTRICAL",
  "LIFTING",
  "OTHER",
]);

export const matrixStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const matrixVersionStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "ACTIVE",
  "SUPERSEDED",
  "ANNULLED",
]);

export const trainingPlanStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REVISED",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const trainingPlanVersionStatusSchema = z.enum([
  "DRAFT",
  "FINAL",
  "SIGNED",
  "VOIDED",
]);

export const orderStatusSchema = z.enum([
  "DRAFT",
  "IN_APPROVAL",
  "APPROVED",
  "SIGNING_READY",
  "SIGNED",
  "ACTIVE",
  "CANCELED",
  "SUPERSEDED",
  "ARCHIVED",
]);

export const orderVersionStatusSchema = z.enum([
  "DRAFT",
  "FINAL",
  "SIGNED",
  "VOIDED",
]);

export const briefingJournalStatusSchema = z.enum([
  "DRAFT",
  "IN_APPROVAL",
  "SIGNING_READY",
  "SIGNED",
  "ACTIVE",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const briefingJournalEntryStatusSchema = z.enum([
  "DRAFT",
  "OPENED",
  "ACKNOWLEDGED",
  "SIGNING_READY",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const briefingParticipantStatusSchema = z.enum([
  "ASSIGNED",
  "OPENED",
  "ACKNOWLEDGED",
  "SIGNED",
  "OVERDUE",
  "ARCHIVED",
]);

export const workPermitStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "APPROVED",
  "SIGNING_READY",
  "SIGNED",
  "ACTIVE",
  "CLOSED",
  "SUSPENDED",
  "EXPIRED",
  "ANNULLED",
  "ARCHIVED",
]);

export const workPermitVersionStatusSchema = z.enum([
  "DRAFT",
  "FINAL",
  "SIGNED",
  "VOIDED",
]);

export const qualificationDocumentStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "ANNULLED",
  "ARCHIVED",
]);

export const qualificationDocumentKindSchema = z.enum([
  "CERTIFICATE",
  "LICENSE",
  "MEDICAL_CLEARANCE",
  "ATTESTATION",
  "OTHER",
]);

export const clearanceTypeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const trainingTypeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  requiresExam: z.boolean(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const admissionCheckResultSchema = z.object({
  code: z.string(),
  result: z.enum(["PASS", "FAIL", "SKIP"]),
  severity: admissionSeveritySchema,
  message: z.string().nullable().optional(),
  evidence: z.array(z.string()).default([]),
});

export const admissionEvaluationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  subjectType: admissionSubjectTypeSchema,
  subjectId: z.string(),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  workType: workPermitTypeSchema,
  matrixVersionId: z.string().nullable().optional(),
  trainingPlanVersionId: z.string().nullable().optional(),
  briefingJournalEntryId: z.string().nullable().optional(),
  workPermitId: z.string().nullable().optional(),
  status: admissionStatusSchema,
  decisionCode: z.string(),
  ruleVersion: z.string(),
  evaluatedAt: isoStringSchema,
  nextReviewAt: z.string().nullable().optional(),
  checks: z.array(admissionCheckResultSchema),
  warnings: z.array(admissionCheckResultSchema),
  nextActions: z.array(z.string()),
  resultJson: jsonValueSchema,
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const jobRequirementMatrixSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  positionId: z.string().nullable().optional(),
  matrixCode: z.string(),
  status: matrixStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const jobRequirementMatrixVersionSchema = z.object({
  id: z.string(),
  matrixId: z.string(),
  versionNo: z.number().int().positive(),
  status: matrixVersionStatusSchema,
  payloadJson: jsonValueSchema,
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
});

export const trainingPlanSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  planCode: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  matrixVersionId: z.string().nullable().optional(),
  status: trainingPlanStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  requiresExam: z.boolean(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const trainingPlanVersionSchema = z.object({
  id: z.string(),
  trainingPlanId: z.string(),
  versionNo: z.number().int().positive(),
  status: trainingPlanVersionStatusSchema,
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const orderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  orderCode: z.string(),
  orderType: z.string(),
  subject: z.string(),
  basisDocumentId: z.string().nullable().optional(),
  status: orderStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const orderVersionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  versionNo: z.number().int().positive(),
  status: orderVersionStatusSchema,
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const responsibleAssignmentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  orderVersionId: z.string(),
  responsibleType: z.enum(["EMPLOYEE", "CONTRACTOR_WORKER", "ROLE"]),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  roleCode: z.string().nullable().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const briefingJournalSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  journalCode: z.string(),
  title: z.string(),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: briefingJournalStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const coreBriefingJournalEntrySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  journalId: z.string(),
  entryNo: z.number().int().positive(),
  registrationNo: z.string().nullable().optional(),
  journalKind: briefingJournalKindSchema,
  employeeId: z.string(),
  instructorUserId: z.string(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  briefingType: briefingTypeSchema,
  status: briefingJournalEntryStatusSchema,
  employeeStatus: briefingParticipantStatusSchema,
  briefingDate: isoStringSchema,
  briefingTime: z.string().nullable().optional(),
  topic: z.string(),
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
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const workPermitVersionSchema = z.object({
  id: z.string(),
  permitId: z.string(),
  versionNo: z.number().int().positive(),
  status: workPermitVersionStatusSchema,
  payloadJson: jsonValueSchema,
  documentEnvelopeId: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const brigadeSchema = z.object({
  id: z.string(),
  permitId: z.string(),
  brigadeCode: z.string(),
  title: z.string(),
  leaderEmployeeId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const brigadeMemberSchema = z.object({
  id: z.string(),
  brigadeId: z.string(),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  roleCode: z.string(),
  status: z.enum(["ASSIGNED", "READY", "SIGNED", "REJECTED"]),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const workPermitSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  permitCode: z.string(),
  permitType: workPermitTypeSchema,
  title: z.string(),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: workPermitStatusSchema,
  currentVersionId: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  effectiveFrom: z.string().nullable().optional(),
  effectiveTo: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const qualificationDocumentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  clearanceTypeId: z.string().nullable().optional(),
  trainingTypeId: z.string().nullable().optional(),
  documentKind: qualificationDocumentKindSchema,
  documentNumber: z.string(),
  issueDate: isoStringSchema,
  expiryDate: z.string().nullable().optional(),
  status: qualificationDocumentStatusSchema,
  documentEnvelopeId: z.string().nullable().optional(),
  createdAt: isoStringSchema,
  updatedAt: isoStringSchema,
});

export const createClearanceTypeSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  description: z.string().max(1000).nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createTrainingTypeSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  description: z.string().max(1000).nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  requiresExam: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const createAdmissionCheckSchema = z.object({
  organizationId: z.string().optional(),
  subjectType: admissionSubjectTypeSchema,
  subjectId: z.string().min(1),
  employeeId: z.string().nullable().optional(),
  contractorWorkerId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  workType: workPermitTypeSchema,
  matrixVersionId: z.string().nullable().optional(),
  trainingPlanVersionId: z.string().nullable().optional(),
  briefingJournalEntryId: z.string().nullable().optional(),
  workPermitId: z.string().nullable().optional(),
  evaluatedAt: z.string().optional(),
});

export type AdmissionSubjectType = z.infer<typeof admissionSubjectTypeSchema>;
export type AdmissionStatus = z.infer<typeof admissionStatusSchema>;
export type AdmissionSeverity = z.infer<typeof admissionSeveritySchema>;
export type WorkPermitType = z.infer<typeof workPermitTypeSchema>;
export type MatrixStatus = z.infer<typeof matrixStatusSchema>;
export type MatrixVersionStatus = z.infer<typeof matrixVersionStatusSchema>;
export type TrainingPlanStatus = z.infer<typeof trainingPlanStatusSchema>;
export type TrainingPlanVersionStatus = z.infer<typeof trainingPlanVersionStatusSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderVersionStatus = z.infer<typeof orderVersionStatusSchema>;
export type BriefingJournalStatus = z.infer<typeof briefingJournalStatusSchema>;
export type BriefingJournalEntryStatus = z.infer<typeof briefingJournalEntryStatusSchema>;
export type WorkPermitStatus = z.infer<typeof workPermitStatusSchema>;
export type WorkPermitVersionStatus = z.infer<typeof workPermitVersionStatusSchema>;
export type QualificationDocumentStatus = z.infer<typeof qualificationDocumentStatusSchema>;
export type QualificationDocumentKind = z.infer<typeof qualificationDocumentKindSchema>;
export type ClearanceType = z.infer<typeof clearanceTypeSchema>;
export type TrainingType = z.infer<typeof trainingTypeSchema>;
export type AdmissionCheckResult = z.infer<typeof admissionCheckResultSchema>;
export type AdmissionEvaluation = z.infer<typeof admissionEvaluationSchema>;
export type JobRequirementMatrix = z.infer<typeof jobRequirementMatrixSchema>;
export type JobRequirementMatrixVersion = z.infer<typeof jobRequirementMatrixVersionSchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
export type TrainingPlanVersion = z.infer<typeof trainingPlanVersionSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderVersion = z.infer<typeof orderVersionSchema>;
export type ResponsibleAssignment = z.infer<typeof responsibleAssignmentSchema>;
export type BriefingJournal = z.infer<typeof briefingJournalSchema>;
export type CoreBriefingJournalEntry = z.infer<typeof coreBriefingJournalEntrySchema>;
export type WorkPermitVersion = z.infer<typeof workPermitVersionSchema>;
export type Brigade = z.infer<typeof brigadeSchema>;
export type BrigadeMember = z.infer<typeof brigadeMemberSchema>;
export type WorkPermit = z.infer<typeof workPermitSchema>;
export type QualificationDocument = z.infer<typeof qualificationDocumentSchema>;
export type CreateClearanceTypeInput = z.infer<typeof createClearanceTypeSchema>;
export type CreateTrainingTypeInput = z.infer<typeof createTrainingTypeSchema>;
export type CreateAdmissionCheckInput = z.infer<typeof createAdmissionCheckSchema>;
