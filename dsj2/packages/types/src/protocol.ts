import { z } from "zod";
import { employeeAdmissionStatusSummarySchema } from "./compliance";
import {
  archiveRecordStatusSchema,
  canonicalDocumentStatusSchema,
  documentEnvelopeStatusSchema,
  documentVersionStatusSchema,
  signatureVerificationResultSchema,
} from "./core-document";
import { scopeTypeSchema } from "./core-identity";
import {
  documentHashSchema,
  optionalBriefingSignInputSchema,
  signatureProviderSchema,
} from "./signing";

const isoStringSchema = z.string().min(1);

export const protocolStatusSchema = z.enum([
  "DRAFT",
  "SIGNING_READY",
  "SIGNED",
  "ANNULLED",
  "SUPERSEDED",
  "EXPIRED",
]);

export const protocolCommissionRoleSchema = z.enum(["CHAIRMAN", "MEMBER"]);

export const protocolAllowedActionsSchema = z.object({
  canEditDraft: z.boolean(),
  canPrepareSign: z.boolean(),
  canSign: z.boolean(),
  canAnnul: z.boolean(),
  canReplace: z.boolean(),
  canDownloadEvidence: z.boolean(),
  canViewArchive: z.boolean(),
});

export const protocolSignatureSummarySchema = z.object({
  id: z.string(),
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

export const protocolArchiveSummarySchema = z.object({
  id: z.string(),
  status: archiveRecordStatusSchema,
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  storageUri: z.string().nullable().optional(),
  retentionCode: z.string(),
  retentionSource: z.enum(["configured", "baseline"]),
});

export const protocolHistorySummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  lastAction: z.string().nullable().optional(),
  lastAt: z.string().nullable().optional(),
});

export const protocolScopeRefSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  location: z.string().nullable().optional(),
});

export const protocolEmployeeSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  employeeNumber: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  departmentName: z.string().nullable().optional(),
});

export const protocolCommissionMemberSchema = z.object({
  role: protocolCommissionRoleSchema,
  fullName: z.string(),
  jobTitle: z.string().nullable().optional(),
});

export const protocolComplianceImpactSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  admissionStatus: employeeAdmissionStatusSummarySchema.nullable().optional(),
  decisionCode: z.string().nullable().optional(),
  evaluatedAt: z.string().nullable().optional(),
  basisLabel: z.string(),
});

export const protocolSigningContractSchema = z.object({
  mode: z.literal("ORGANIZATION"),
  requiresExternalSignature: z.boolean(),
  documentHash: documentHashSchema,
  provider: signatureProviderSchema.nullable().optional(),
  signRole: z.literal("COMMISSION_SIGNER"),
  bridgeContext: z.object({
    protocolId: z.string(),
    documentNumber: z.string().nullable().optional(),
  }),
});

export const protocolSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  number: z.string(),
  date: isoStringSchema,
  protocolType: z.string(),
  basis: z.string(),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: protocolStatusSchema,
  decision: z.string(),
  notes: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
  currentVersionNo: z.number().int().positive().nullable().optional(),
  signedAt: z.string().nullable().optional(),
  replacesProtocolId: z.string().nullable().optional(),
  canonicalStatus: canonicalDocumentStatusSchema.nullable().optional(),
  documentEnvelopeStatus: documentEnvelopeStatusSchema.nullable().optional(),
  documentVersionStatus: documentVersionStatusSchema.nullable().optional(),
  signingDigest: documentHashSchema.nullable().optional(),
  isSigned: z.boolean().default(false),
  evidenceAvailable: z.boolean().default(false),
  latestSignature: protocolSignatureSummarySchema.nullable().optional(),
  archiveRecordSummary: protocolArchiveSummarySchema.nullable().optional(),
  historySummary: protocolHistorySummarySchema,
  allowedActions: protocolAllowedActionsSchema,
  employees: z.array(protocolEmployeeSchema),
  commission: z.array(protocolCommissionMemberSchema),
  complianceImpact: z.array(protocolComplianceImpactSchema).default([]),
  branch: protocolScopeRefSchema.nullable().optional(),
  department: protocolScopeRefSchema.nullable().optional(),
  workSite: protocolScopeRefSchema.nullable().optional(),
});

export const protocolRegistryItemSchema = protocolSchema.pick({
  id: true,
  organizationId: true,
  number: true,
  date: true,
  protocolType: true,
  basis: true,
  status: true,
  decision: true,
  documentEnvelopeId: true,
  currentVersionId: true,
  currentVersionNo: true,
  signedAt: true,
  canonicalStatus: true,
  documentEnvelopeStatus: true,
  isSigned: true,
  evidenceAvailable: true,
  archiveRecordSummary: true,
  historySummary: true,
  employees: true,
  complianceImpact: true,
  departmentId: true,
  department: true,
});

export const protocolCommissionMemberInputSchema = z.object({
  fullName: z.string().min(2).max(255),
  jobTitle: z.string().max(255).nullable().optional(),
});

export const createProtocolSchema = z.object({
  organizationId: z.string().optional(),
  number: z.string().min(2).max(120),
  date: isoStringSchema,
  protocolType: z.string().min(2).max(120),
  basis: z.string().min(2).max(1000),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  decision: z.string().min(2).max(4000),
  notes: z.string().max(4000).nullable().optional(),
  employeeIds: z.array(z.string()).min(1),
  chairman: protocolCommissionMemberInputSchema,
  members: z.array(protocolCommissionMemberInputSchema).default([]),
  status: protocolStatusSchema.default("DRAFT"),
});

export const updateProtocolSchema = z.object({
  organizationId: z.string().optional(),
  number: z.string().min(2).max(120).optional(),
  date: isoStringSchema.optional(),
  protocolType: z.string().min(2).max(120).optional(),
  basis: z.string().min(2).max(1000).optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  decision: z.string().min(2).max(4000).optional(),
  notes: z.string().max(4000).nullable().optional(),
  employeeIds: z.array(z.string()).min(1).optional(),
  chairman: protocolCommissionMemberInputSchema.optional(),
  members: z.array(protocolCommissionMemberInputSchema).optional(),
});

export const protocolFilterSchema = z.object({
  organizationId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: isoStringSchema.optional(),
  dateTo: isoStringSchema.optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  status: protocolStatusSchema.optional(),
});

export const prepareProtocolForSigningSchema = z.object({});

export const signProtocolSchema = optionalBriefingSignInputSchema;
export const protocolSignRequestSchema = signProtocolSchema;

export const annulProtocolSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
});

export const replaceProtocolSchema = createProtocolSchema
  .omit({
    organizationId: true,
  })
  .extend({
    reason: z.string().max(1000).nullable().optional(),
  });

export const prepareProtocolForSigningResponseSchema = z.object({
  protocol: protocolSchema,
  envelopeId: z.string(),
  versionId: z.string(),
  versionNo: z.number().int().positive(),
  digest: documentHashSchema,
  allowedActions: protocolAllowedActionsSchema,
  contract: protocolSigningContractSchema,
});

export type ProtocolStatus = z.infer<typeof protocolStatusSchema>;
export type ProtocolCommissionRole = z.infer<typeof protocolCommissionRoleSchema>;
export type Protocol = z.infer<typeof protocolSchema>;
export type ProtocolRegistryItem = z.infer<typeof protocolRegistryItemSchema>;
export type ProtocolEmployee = z.infer<typeof protocolEmployeeSchema>;
export type ProtocolCommissionMember = z.infer<typeof protocolCommissionMemberSchema>;
export type ProtocolComplianceImpact = z.infer<typeof protocolComplianceImpactSchema>;
export type CreateProtocolInput = z.infer<typeof createProtocolSchema>;
export type UpdateProtocolInput = z.infer<typeof updateProtocolSchema>;
export type ProtocolFilters = z.infer<typeof protocolFilterSchema>;
export type PrepareProtocolForSigningInput = z.infer<
  typeof prepareProtocolForSigningSchema
>;
export type SignProtocolInput = z.infer<typeof signProtocolSchema>;
export type AnnulProtocolInput = z.infer<typeof annulProtocolSchema>;
export type ReplaceProtocolInput = z.infer<typeof replaceProtocolSchema>;
