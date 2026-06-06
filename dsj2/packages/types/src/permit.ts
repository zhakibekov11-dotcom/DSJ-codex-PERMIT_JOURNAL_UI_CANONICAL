import { z } from "zod";
import { scopeTypeSchema } from "./core-identity";

const optionalId = z.string().min(1).nullable().optional();
const isoDateTime = z.string().datetime({ offset: true });

export const permitTypeSchema = z.enum([
  "HIGH_RISK_WORK",
  "CONTRACTOR_ACCESS",
  "SELF_WORK_ADMISSION",
  "AFTER_BRIEFING_ADMISSION",
  "AFTER_TRAINING_ADMISSION",
  "MEDICAL_BASED_ADMISSION",
  "PPE_BASED_ADMISSION",
]);

export const permitWorkTypeSchema = z.enum([
  "GENERAL_HIGH_RISK",
  "HEIGHT_WORK",
  "HOT_WORK",
  "GAS_HAZARDOUS_WORK",
  "ELECTRICAL_WORK",
  "EARTH_WORK",
  "CONFINED_SPACE",
  "LIFTING_WORK",
  "CONTRACTOR_SITE_ACCESS",
]);

export const mvpPermitWorkTypeSchema = z.enum([
  "GENERAL_HIGH_RISK",
  "HEIGHT_WORK",
  "CONTRACTOR_SITE_ACCESS",
]);

export const permitStatusSchema = z.enum([
  "draft",
  "pending_precheck",
  "missing_documents",
  "pending_approval",
  "approved",
  "signing_ready",
  "signed",
  "active",
  "suspended",
  "extended",
  "closed",
  "rejected",
  "cancelled",
  "expired",
  "archived",
]);

export const permitSubjectSchema = z.object({
  employeeId: optionalId,
  contractorWorkerId: optionalId,
  roleCode: z.string().min(1).max(120),
});

export const permitSnapshotEvidenceSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  sourceStatus: z.string(),
  sourceHash: z.string(),
  issuedAt: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  subjectId: z.string().nullable().optional(),
  documentNumber: z.string().nullable().optional(),
});

export const permitSnapshotSchema = z.object({
  checkedAt: isoDateTime,
  result: z.enum(["PASS", "FAIL"]),
  evidence: z.array(permitSnapshotEvidenceSchema),
});

export const permitPrecheckCheckSchema = z.object({
  code: z.string(),
  label: z.string(),
  result: z.enum(["PASS", "FAIL"]),
  severity: z.enum(["BLOCKER", "WARNING"]),
  message: z.string(),
  evidence: z.array(z.string()),
});

export const permitClosureSchema = z.object({
  result: z.string().min(1),
  inspection: z.string().min(1),
  closedAt: isoDateTime.optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const permitEntrySchema = z.object({
  id: z.string().optional(),
  companyId: optionalId,
  journalId: optionalId,
  permitNumber: z.string().min(2).max(64),
  journalRegistrationNumber: z.string().min(2).max(64),
  permitType: permitTypeSchema,
  workType: permitWorkTypeSchema,
  status: permitStatusSchema,
  workDescription: z.string().min(2).max(4000),
  workplace: z.string().min(2).max(1000),
  workZoneId: optionalId,
  departmentId: optionalId,
  startAt: isoDateTime,
  endAt: isoDateTime,
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
  contractorId: optionalId,
  contractorRepresentativeId: optionalId,
  issuerId: optionalId,
  responsibleManagerId: optionalId,
  workProducerId: optionalId,
  admitterId: optionalId,
  observerId: optionalId,
  crew: z.array(permitSubjectSchema).default([]),
  crewMemberIds: z.array(z.string()).default([]),
  hazardFactors: z.array(z.string().min(1)).min(1),
  safetyMeasures: z.string().min(2).max(8000),
  ppeRequirements: z.string().max(4000).nullable().optional(),
  ppeIssueRecordIds: z.array(z.string()).default([]),
  legalBasis: z.array(z.string()).min(1),
  legalBasisVersion: z.string().nullable().optional(),
  legalBasisEffectiveDate: z.string().nullable().optional(),
  trainingEvidenceIds: z.array(z.string()).default([]),
  briefingEvidenceIds: z.array(z.string()).default([]),
  certificateEvidenceIds: z.array(z.string()).default([]),
  medicalEvidenceIds: z.array(z.string()).default([]),
  requiredDocumentIds: z.array(z.string()).default([]),
  precheckSummary: z
    .object({
      result: z.enum(["PASS", "FAIL"]),
      checkedAt: isoDateTime,
      failedRules: z.array(z.string()),
    })
    .nullable()
    .optional(),
  precheckChecks: z.array(permitPrecheckCheckSchema).optional(),
  trainingCheckSnapshot: permitSnapshotSchema.optional(),
  briefingCheckSnapshot: permitSnapshotSchema.optional(),
  certificateCheckSnapshot: permitSnapshotSchema.optional(),
  medicalCheckSnapshot: permitSnapshotSchema
    .extend({ containsDiagnosis: z.literal(false) })
    .optional(),
  ppeIssuedSnapshot: permitSnapshotSchema.optional(),
  requiredDocumentSnapshot: permitSnapshotSchema.optional(),
  approvalStatus: z.string().nullable().optional(),
  signatureStatus: z.string().nullable().optional(),
  suspensionReason: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  closure: permitClosureSchema.nullable().optional(),
  signedPayloadHash: z.string().nullable().optional(),
  documentVersionHash: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  retentionUntil: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const permitCrewInputSchema = z.object({
  employeeIds: z.array(z.string()).default([]),
  contractorWorkerIds: z.array(z.string()).default([]),
});

export const createPermitSchema = z
  .object({
    organizationId: z.string().optional(),
    permitNumber: z.string().min(2).max(64),
    journalRegistrationNumber: z.string().min(2).max(64),
    permitType: permitTypeSchema,
    workType: mvpPermitWorkTypeSchema,
    workDescription: z.string().min(2).max(4000),
    workplace: z.string().min(2).max(1000),
    scopeType: scopeTypeSchema,
    branchId: optionalId,
    departmentId: optionalId,
    workSiteId: optionalId,
    startAt: isoDateTime,
    endAt: isoDateTime,
    contractorId: optionalId,
    contractorRepresentativeId: optionalId,
    issuerId: optionalId,
    responsibleManagerId: optionalId,
    workProducerId: optionalId,
    admitterId: optionalId,
    observerId: optionalId,
    crew: permitCrewInputSchema.default({
      employeeIds: [],
      contractorWorkerIds: [],
    }),
    hazardFactors: z.array(z.string().min(1)).min(1),
    safetyMeasures: z.string().min(2).max(8000),
    ppeRequirements: z.string().max(4000).nullable().optional(),
    ppeIssueRecordIds: z.array(z.string()).default([]),
    legalBasis: z.array(z.string()).min(1),
    trainingEvidenceIds: z.array(z.string()).default([]),
    briefingEvidenceIds: z.array(z.string()).default([]),
    certificateEvidenceIds: z.array(z.string()).default([]),
    medicalEvidenceIds: z.array(z.string()).default([]),
    requiredDocumentIds: z.array(z.string()).default([]),
  })
  .strict();

export const updatePermitSchema = createPermitSchema
  .omit({ organizationId: true })
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    "At least one field is required.",
  );

export const permitListFilterSchema = z.object({
  organizationId: z.string().optional(),
  permitType: permitTypeSchema.optional(),
  workType: permitWorkTypeSchema.optional(),
  status: permitStatusSchema.optional(),
  departmentId: z.string().optional(),
  contractorId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  missingOnly: z.coerce.boolean().optional(),
  activeOnly: z.coerce.boolean().optional(),
  archivedOnly: z.coerce.boolean().optional(),
  sortBy: z
    .enum(["createdAt", "startAt", "endAt", "permitNumber"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const permitWorkflowSchema = z.object({
  comment: z.string().max(2000).nullable().optional(),
});

export const permitReasonSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const closePermitSchema = z.object({
  comment: z.string().max(2000).nullable().optional(),
  closure: permitClosureSchema,
});

export const preparePermitSignSchema = z.object({
  comment: z.string().max(2000).nullable().optional(),
});

export const createPpeIssueRecordSchema = z
  .object({
    organizationId: z.string().optional(),
    employeeId: optionalId,
    contractorWorkerId: optionalId,
    itemCode: z.string().min(1).max(120),
    itemName: z.string().min(2).max(255),
    issuedAt: isoDateTime,
    validUntil: z.string().datetime({ offset: true }).nullable().optional(),
    sourceDocumentId: optionalId,
  })
  .refine(
    (input) => Boolean(input.employeeId) !== Boolean(input.contractorWorkerId),
    "Exactly one PPE recipient is required.",
  );

export type PermitType = z.infer<typeof permitTypeSchema>;
export type PermitWorkType = z.infer<typeof permitWorkTypeSchema>;
export type MvpPermitWorkType = z.infer<typeof mvpPermitWorkTypeSchema>;
export type PermitStatus = z.infer<typeof permitStatusSchema>;
export type PermitEntry = z.infer<typeof permitEntrySchema>;
export type PermitSnapshot = z.infer<typeof permitSnapshotSchema>;
export type PermitPrecheckCheck = z.infer<typeof permitPrecheckCheckSchema>;
export type CreatePermitInput = z.infer<typeof createPermitSchema>;
export type UpdatePermitInput = z.infer<typeof updatePermitSchema>;
export type PermitListFilter = z.infer<typeof permitListFilterSchema>;
export type PermitWorkflowInput = z.infer<typeof permitWorkflowSchema>;
export type PermitReasonInput = z.infer<typeof permitReasonSchema>;
export type ClosePermitInput = z.infer<typeof closePermitSchema>;
export type PreparePermitSignInput = z.infer<typeof preparePermitSignSchema>;
export type CreatePpeIssueRecordInput = z.infer<
  typeof createPpeIssueRecordSchema
>;
