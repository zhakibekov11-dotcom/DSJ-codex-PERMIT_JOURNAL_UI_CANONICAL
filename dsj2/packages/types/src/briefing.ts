import { z } from "zod";
import {
  archiveRecordStatusSchema,
  canonicalDocumentStatusSchema,
  documentEnvelopeStatusSchema,
  documentVersionStatusSchema,
  signatureVerificationResultSchema,
} from "./core-document";
import {
  briefingSignInputSchema,
  documentHashSchema,
  optionalBriefingSignInputSchema,
  signatureProviderSchema,
  type BriefingSignInput,
  type OptionalBriefingSignInput,
} from "./signing";

const isoStringSchema = z.string().min(1);

export const briefingTypeSchema = z.enum([
  "INTRODUCTORY",
  "PRIMARY",
  "REPEATED",
  "UNSCHEDULED",
  "TARGETED",
]);

export const briefingJournalKindSchema = z.enum([
  "INTRODUCTORY",
  "WORKPLACE",
]);

export const briefingStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_SIGNING",
  "SIGNING_READY",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const briefingReadModelStatusSchema = z.enum([
  "DRAFT",
  "SIGNING_READY",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "SUPERSEDED",
  "ANNULLED",
  "ARCHIVED",
]);

export const employeeInstructionStatusSchema = z.enum([
  "ASSIGNED",
  "OPENED",
  "ACKNOWLEDGED",
  "SIGNED",
  "OVERDUE",
]);

export const briefingSignerRoleSchema = z.enum([
  "BRIEFING_INSTRUCTOR",
  "BRIEFED_EMPLOYEE",
]);

export const briefingAllowedActionsSchema = z.object({
  canEditDraft: z.boolean(),
  canPrepareSign: z.boolean(),
  canInstructorSign: z.boolean(),
  canEmployeeSign: z.boolean(),
  canAnnul: z.boolean(),
  canReplace: z.boolean(),
  canDownloadEvidence: z.boolean(),
  canViewArchive: z.boolean(),
});

export const briefingSignatureSummarySchema = z.object({
  id: z.string(),
  signerRole: briefingSignerRoleSchema.nullable().optional(),
  provider: signatureProviderSchema,
  status: z.string(),
  signerName: z.string(),
  signerIinMasked: z.string(),
  certificateSerial: z.string(),
  signedAt: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  verificationResult: signatureVerificationResultSchema.nullable().optional(),
  chainStatus: z.string().nullable().optional(),
  revocationStatus: z.string().nullable().optional(),
  signatureHash: z.string().nullable().optional(),
});

export const briefingArchiveSummarySchema = z.object({
  id: z.string(),
  status: archiveRecordStatusSchema,
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  storageUri: z.string().nullable().optional(),
  retentionCode: z.string(),
  retentionSource: z.enum(["configured", "baseline"]),
});

export const briefingHistorySummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  lastAction: z.string().nullable().optional(),
  lastAt: z.string().nullable().optional(),
});

export const briefingScopeRefSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  location: z.string().nullable().optional(),
});

export const briefingEmployeeSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  employeeNumber: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  departmentName: z.string().nullable().optional(),
  hasAccount: z.boolean().default(false),
  accountRole: z.string().nullable().optional(),
  hasEmployeeSignerAccount: z.boolean().default(false),
});

export const briefingInstructorSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  role: z.string().nullable().optional(),
});

export const briefingComplianceImpactSchema = z.object({
  employeeId: z.string(),
  admissionStatus: z.enum(["admitted", "limited", "blocked"]).nullable().optional(),
  decisionCode: z.string().nullable().optional(),
  evaluatedAt: z.string().nullable().optional(),
  basisLabel: z.string(),
});

export const briefingSignerStateSchema = z.object({
  role: briefingSignerRoleSchema,
  status: z.enum(["PENDING", "SIGNED"]),
  signedAt: z.string().nullable().optional(),
  signerName: z.string().nullable().optional(),
});

export const briefingSigningContractSchema = z.object({
  mode: z.literal("ORGANIZATION"),
  requiresExternalSignature: z.boolean(),
  documentHash: documentHashSchema,
  provider: signatureProviderSchema.nullable().optional(),
  signRole: briefingSignerRoleSchema,
  bridgeContext: z.object({
    briefingJournalEntryId: z.string(),
    registrationNo: z.string().nullable().optional(),
  }),
});

export const briefingJournalEntrySchema = z.object({
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
  status: briefingReadModelStatusSchema,
  briefingDate: isoStringSchema,
  briefingTime: z.string().nullable().optional(),
  topic: z.string(),
  program: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  unscheduledReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  annulReason: z.string().nullable().optional(),
  finalSignedAt: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
  currentVersionNo: z.number().int().positive().nullable().optional(),
  canonicalStatus: canonicalDocumentStatusSchema.nullable().optional(),
  documentEnvelopeStatus: documentEnvelopeStatusSchema.nullable().optional(),
  documentVersionStatus: documentVersionStatusSchema.nullable().optional(),
  signingDigest: documentHashSchema.nullable().optional(),
  evidenceAvailable: z.boolean().default(false),
  archiveRecordSummary: briefingArchiveSummarySchema.nullable().optional(),
  signatures: z.array(briefingSignatureSummarySchema).default([]),
  pendingSigners: z.array(briefingSignerStateSchema).default([]),
  historySummary: briefingHistorySummarySchema,
  allowedActions: briefingAllowedActionsSchema,
  employee: briefingEmployeeSchema,
  instructor: briefingInstructorSchema,
  department: briefingScopeRefSchema.nullable().optional(),
  workSite: briefingScopeRefSchema.nullable().optional(),
  complianceImpact: briefingComplianceImpactSchema.nullable().optional(),
});

export const briefingRegistryItemSchema = briefingJournalEntrySchema.pick({
  id: true,
  organizationId: true,
  registrationNo: true,
  journalKind: true,
  briefingType: true,
  status: true,
  briefingDate: true,
  topic: true,
  finalSignedAt: true,
  canonicalStatus: true,
  evidenceAvailable: true,
  archiveRecordSummary: true,
  historySummary: true,
  allowedActions: true,
  employee: true,
  instructor: true,
  department: true,
  workSite: true,
});

export const myBriefingInstructionSchema = briefingJournalEntrySchema.pick({
  id: true,
  organizationId: true,
  registrationNo: true,
  journalKind: true,
  briefingType: true,
  status: true,
  briefingDate: true,
  briefingTime: true,
  topic: true,
  notes: true,
  finalSignedAt: true,
  signingDigest: true,
  evidenceAvailable: true,
  archiveRecordSummary: true,
  pendingSigners: true,
  allowedActions: true,
  employee: true,
  instructor: true,
  department: true,
  workSite: true,
});

export const createBriefingSchema = z.object({
  companyId: z.string().optional(),
  employeeIds: z.array(z.string()).min(1),
  journalKind: briefingJournalKindSchema.optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  instructorUserId: z.string(),
  briefingType: briefingTypeSchema,
  briefingDate: isoStringSchema,
  briefingTime: z.string().nullable().optional(),
  topic: z.string().min(3),
  program: z.string().max(4000).nullable().optional(),
  basis: z.string().max(4000).nullable().optional(),
  unscheduledReason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: briefingStatusSchema.default("DRAFT"),
});

export const updateBriefingSchema = z.object({
  companyId: z.string().optional(),
  employeeId: z.string().optional(),
  journalKind: briefingJournalKindSchema.optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
  instructorUserId: z.string().optional(),
  briefingType: briefingTypeSchema.optional(),
  briefingDate: isoStringSchema.optional(),
  briefingTime: z.string().nullable().optional(),
  topic: z.string().min(3).optional(),
  program: z.string().max(4000).nullable().optional(),
  basis: z.string().max(4000).nullable().optional(),
  unscheduledReason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: briefingStatusSchema.optional(),
});

export const briefingFilterSchema = z.object({
  companyId: z.string().optional(),
  search: z.string().optional(),
  journalKind: briefingJournalKindSchema.optional(),
  briefingType: briefingTypeSchema.optional(),
  employeeId: z.string().optional(),
  instructorUserId: z.string().optional(),
  departmentId: z.string().optional(),
  workSiteId: z.string().optional(),
  status: briefingReadModelStatusSchema.optional(),
  startDate: isoStringSchema.optional(),
  endDate: isoStringSchema.optional(),
});

export const prepareSigningSchema = z.object({});

export const signBriefingSchema = optionalBriefingSignInputSchema;
export const publicSignBriefingSchema = briefingSignInputSchema;
export const optionalPublicSignBriefingSchema = optionalBriefingSignInputSchema;

export const annulBriefingSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
});

export const replaceBriefingSchema = createBriefingSchema
  .omit({
    companyId: true,
  })
  .extend({
    reason: z.string().max(1000).nullable().optional(),
  });

export const prepareBriefingForSigningResponseSchema = z.object({
  briefing: briefingJournalEntrySchema,
  envelopeId: z.string(),
  versionId: z.string(),
  versionNo: z.number().int().positive(),
  digest: documentHashSchema,
  pendingSigners: z.array(briefingSignerStateSchema),
  allowedActions: briefingAllowedActionsSchema,
  contract: briefingSigningContractSchema,
});

export const publicBriefingInviteSchema = z.object({
  documentNumber: z.string().nullable(),
  briefingType: briefingTypeSchema,
  briefingDate: z.string(),
  topic: z.string(),
  notes: z.string().nullable(),
  status: briefingStatusSchema,
  signingDigest: documentHashSchema.nullable(),
  inviteTokenExpiresAt: z.string().nullable(),
  signedAt: z.string().nullable(),
  publicMockSignEnabled: z.boolean(),
  signingAvailable: z.boolean(),
  employee: z.object({
    fullName: z.string(),
    jobTitle: z.string(),
  }),
  instructor: z.object({
    fullName: z.string(),
  }),
  department: z
    .object({
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export type BriefingType = z.infer<typeof briefingTypeSchema>;
export type BriefingJournalKind = z.infer<typeof briefingJournalKindSchema>;
export type BriefingStatus = z.infer<typeof briefingStatusSchema>;
export type BriefingReadModelStatus = z.infer<typeof briefingReadModelStatusSchema>;
export type EmployeeInstructionStatus = z.infer<typeof employeeInstructionStatusSchema>;
export type BriefingSignerRole = z.infer<typeof briefingSignerRoleSchema>;
export type BriefingAllowedActions = z.infer<typeof briefingAllowedActionsSchema>;
export type BriefingJournalEntry = z.infer<typeof briefingJournalEntrySchema>;
export type BriefingRegistryItem = z.infer<typeof briefingRegistryItemSchema>;
export type MyBriefingInstruction = z.infer<typeof myBriefingInstructionSchema>;
export type CreateBriefingInput = z.infer<typeof createBriefingSchema>;
export type UpdateBriefingInput = z.infer<typeof updateBriefingSchema>;
export type BriefingFilters = z.infer<typeof briefingFilterSchema>;
export type PrepareSigningInput = z.infer<typeof prepareSigningSchema>;
export type SignBriefingInput = z.infer<typeof signBriefingSchema>;
export type AnnulBriefingInput = z.infer<typeof annulBriefingSchema>;
export type ReplaceBriefingInput = z.infer<typeof replaceBriefingSchema>;
export type PrepareBriefingForSigningResponse = z.infer<
  typeof prepareBriefingForSigningResponseSchema
>;
export type PublicSignBriefingInput = BriefingSignInput;
export type OptionalPublicSignBriefingInput = OptionalBriefingSignInput;
export type PublicBriefingInvite = z.infer<typeof publicBriefingInviteSchema>;
