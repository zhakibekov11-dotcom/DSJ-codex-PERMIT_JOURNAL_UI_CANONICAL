import { z } from "zod";
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

export const responsibilityTypeSchema = z.enum([
  "OCCUPATIONAL_SAFETY_RESPONSIBLE",
  "FIRE_SAFETY_RESPONSIBLE",
  "DEPARTMENT_RESPONSIBLE",
  "OBJECT_RESPONSIBLE",
  "INSTRUCTOR_APPOINTMENT",
  "BRIEFING_AUTHORIZED_PERSON",
  "PERMIT_ISSUER_AUTHORIZED_PERSON",
  "RESPONSIBLE_WORK_MANAGER",
]);

export const responsibilityOrderStatusSchema = z.enum([
  "DRAFT",
  "SIGNING_READY",
  "SIGNED",
  "ACTIVE",
  "ANNULLED",
  "SUPERSEDED",
  "EXPIRED",
]);

export const responsibilityOrderAllowedActionsSchema = z.object({
  canEditDraft: z.boolean(),
  canPrepareSign: z.boolean(),
  canSign: z.boolean(),
  canAnnul: z.boolean(),
  canReplace: z.boolean(),
  canDownloadEvidence: z.boolean(),
  canViewArchive: z.boolean(),
});

export const responsibilityOrderSignatureSummarySchema = z.object({
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

export const responsibilityOrderArchiveSummarySchema = z.object({
  id: z.string(),
  status: archiveRecordStatusSchema,
  sealedAt: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  disposalEligibleAt: z.string().nullable().optional(),
  storageUri: z.string().nullable().optional(),
  retentionCode: z.string(),
  retentionSource: z.enum(["configured", "baseline"]),
});

export const responsibilityOrderHistorySummarySchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  lastAction: z.string().nullable().optional(),
  lastAt: z.string().nullable().optional(),
});

export const responsibilityOrderScopeRefSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  location: z.string().nullable().optional(),
});

export const responsibilityOrderEmployeeRefSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  employeeNumber: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  departmentName: z.string().nullable().optional(),
});

export const responsibilityOrderAppointmentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  employeeId: z.string(),
  employee: responsibilityOrderEmployeeRefSchema,
  responsibilityType: responsibilityTypeSchema,
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  zoneOfResponsibility: z.string().nullable().optional(),
  roleNotes: z.string().nullable().optional(),
  active: z.boolean(),
  derivedStatus: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]),
});

export const responsibilityOrderConflictSchema = z.object({
  blocking: z.boolean(),
  responsibilityType: responsibilityTypeSchema,
  conflictingOrderId: z.string(),
  conflictingOrderNumber: z.string(),
  conflictingOrderStatus: responsibilityOrderStatusSchema,
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  sourceAppointmentId: z.string(),
  sourceEmployeeId: z.string(),
  sourceEmployeeName: z.string(),
  message: z.string(),
});

export const responsibilityOrderConflictSummarySchema = z.object({
  blocking: z.boolean(),
  count: z.number().int().nonnegative(),
  items: z.array(responsibilityOrderConflictSchema),
});

export const responsibilityOrderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  number: z.string(),
  date: isoStringSchema,
  responsibilityType: responsibilityTypeSchema,
  title: z.string(),
  basis: z.string(),
  notes: z.string().nullable().optional(),
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  status: responsibilityOrderStatusSchema,
  signedAt: z.string().nullable().optional(),
  documentEnvelopeId: z.string().nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
  currentVersionNo: z.number().int().positive().nullable().optional(),
  replacesOrderId: z.string().nullable().optional(),
  canonicalStatus: canonicalDocumentStatusSchema.nullable().optional(),
  documentEnvelopeStatus: documentEnvelopeStatusSchema.nullable().optional(),
  documentVersionStatus: documentVersionStatusSchema.nullable().optional(),
  signingDigest: documentHashSchema.nullable().optional(),
  isSigned: z.boolean().default(false),
  evidenceAvailable: z.boolean().default(false),
  latestSignature: responsibilityOrderSignatureSummarySchema.nullable().optional(),
  archiveRecordSummary: responsibilityOrderArchiveSummarySchema.nullable().optional(),
  historySummary: responsibilityOrderHistorySummarySchema,
  allowedActions: responsibilityOrderAllowedActionsSchema,
  appointments: z.array(responsibilityOrderAppointmentSchema),
  branch: responsibilityOrderScopeRefSchema.nullable().optional(),
  department: responsibilityOrderScopeRefSchema.nullable().optional(),
  workSite: responsibilityOrderScopeRefSchema.nullable().optional(),
  conflictSummary: responsibilityOrderConflictSummarySchema,
});

export const responsibilityOrderRegistryItemSchema = responsibilityOrderSchema.pick({
  id: true,
  organizationId: true,
  number: true,
  date: true,
  responsibilityType: true,
  title: true,
  basis: true,
  status: true,
  signedAt: true,
  canonicalStatus: true,
  documentEnvelopeStatus: true,
  isSigned: true,
  evidenceAvailable: true,
  archiveRecordSummary: true,
  historySummary: true,
  appointments: true,
  departmentId: true,
  department: true,
  workSiteId: true,
  workSite: true,
  conflictSummary: true,
});

export const responsibilityOrderAppointmentInputSchema = z.object({
  employeeId: z.string().min(1),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  zoneOfResponsibility: z.string().max(1000).nullable().optional(),
  roleNotes: z.string().max(1000).nullable().optional(),
});

export const createResponsibilityOrderSchema = z.object({
  organizationId: z.string().optional(),
  number: z.string().min(2).max(120),
  date: isoStringSchema,
  responsibilityType: responsibilityTypeSchema,
  title: z.string().min(2).max(255),
  basis: z.string().min(2).max(2000),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  appointments: z.array(responsibilityOrderAppointmentInputSchema).min(1),
  status: responsibilityOrderStatusSchema.default("DRAFT"),
});

export const updateResponsibilityOrderSchema = z.object({
  organizationId: z.string().optional(),
  number: z.string().min(2).max(120).optional(),
  date: isoStringSchema.optional(),
  responsibilityType: responsibilityTypeSchema.optional(),
  title: z.string().min(2).max(255).optional(),
  basis: z.string().min(2).max(2000).optional(),
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  appointments: z.array(responsibilityOrderAppointmentInputSchema).min(1).optional(),
});

export const responsibilityOrderFilterSchema = z.object({
  organizationId: z.string().optional(),
  search: z.string().optional(),
  responsibilityType: responsibilityTypeSchema.optional(),
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  workSiteId: z.string().optional(),
  status: responsibilityOrderStatusSchema.optional(),
  dateFrom: isoStringSchema.optional(),
  dateTo: isoStringSchema.optional(),
});

export const prepareResponsibilityOrderForSigningSchema = z.object({});

export const signResponsibilityOrderSchema = optionalBriefingSignInputSchema;

export const annulResponsibilityOrderSchema = z.object({
  reason: z.string().max(1000).nullable().optional(),
});

export const replaceResponsibilityOrderSchema = createResponsibilityOrderSchema
  .omit({
    organizationId: true,
  })
  .extend({
    reason: z.string().max(1000).nullable().optional(),
  });

export const prepareResponsibilityOrderForSigningResponseSchema = z.object({
  order: responsibilityOrderSchema,
  envelopeId: z.string(),
  versionId: z.string(),
  versionNo: z.number().int().positive(),
  digest: documentHashSchema,
  allowedActions: responsibilityOrderAllowedActionsSchema,
  contract: z.object({
    mode: z.literal("ORGANIZATION"),
    requiresExternalSignature: z.boolean(),
    documentHash: documentHashSchema,
    provider: signatureProviderSchema.nullable().optional(),
    signRole: z.literal("RESPONSIBILITY_ORDER_SIGNER"),
    bridgeContext: z.object({
      responsibilityOrderId: z.string(),
      documentNumber: z.string().nullable().optional(),
    }),
  }),
});

export const responsibilityAppointmentReadModelSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  orderDate: isoStringSchema,
  orderStatus: responsibilityOrderStatusSchema,
  responsibilityType: responsibilityTypeSchema,
  scopeType: scopeTypeSchema,
  branchId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  workSiteId: z.string().nullable().optional(),
  branch: responsibilityOrderScopeRefSchema.nullable().optional(),
  department: responsibilityOrderScopeRefSchema.nullable().optional(),
  workSite: responsibilityOrderScopeRefSchema.nullable().optional(),
  employeeId: z.string(),
  employeeName: z.string(),
  employeeNumber: z.string().nullable().optional(),
  employeeJobTitle: z.string().nullable().optional(),
  effectiveFrom: isoStringSchema,
  effectiveTo: z.string().nullable().optional(),
  zoneOfResponsibility: z.string().nullable().optional(),
  roleNotes: z.string().nullable().optional(),
  active: z.boolean(),
  derivedStatus: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]),
  documentEnvelopeId: z.string().nullable().optional(),
  signedAt: z.string().nullable().optional(),
});

export const responsibilityAppointmentFilterSchema = z.object({
  organizationId: z.string().optional(),
  employeeId: z.string().optional(),
  responsibilityType: responsibilityTypeSchema.optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  workSiteId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]).optional(),
  effectiveAt: isoStringSchema.optional(),
});

export const myResponsibilityOrderItemSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: isoStringSchema,
  responsibilityType: responsibilityTypeSchema,
  title: z.string(),
  basis: z.string(),
  status: responsibilityOrderStatusSchema,
  documentEnvelopeId: z.string().nullable().optional(),
  signedAt: z.string().nullable().optional(),
  evidenceAvailable: z.boolean(),
  archiveRecordSummary: responsibilityOrderArchiveSummarySchema.nullable().optional(),
  branch: responsibilityOrderScopeRefSchema.nullable().optional(),
  department: responsibilityOrderScopeRefSchema.nullable().optional(),
  workSite: responsibilityOrderScopeRefSchema.nullable().optional(),
  appointments: z.array(
    responsibilityOrderAppointmentSchema.pick({
      id: true,
      employeeId: true,
      responsibilityType: true,
      scopeType: true,
      effectiveFrom: true,
      effectiveTo: true,
      zoneOfResponsibility: true,
      roleNotes: true,
      active: true,
      derivedStatus: true,
    }),
  ),
});

export type ResponsibilityType = z.infer<typeof responsibilityTypeSchema>;
export type ResponsibilityOrderStatus = z.infer<typeof responsibilityOrderStatusSchema>;
export type ResponsibilityOrder = z.infer<typeof responsibilityOrderSchema>;
export type ResponsibilityOrderRegistryItem = z.infer<typeof responsibilityOrderRegistryItemSchema>;
export type ResponsibilityOrderAppointment = z.infer<typeof responsibilityOrderAppointmentSchema>;
export type ResponsibilityOrderConflict = z.infer<typeof responsibilityOrderConflictSchema>;
export type ResponsibilityOrderConflictSummary = z.infer<typeof responsibilityOrderConflictSummarySchema>;
export type ResponsibilityOrderAppointmentInput = z.infer<
  typeof responsibilityOrderAppointmentInputSchema
>;
export type CreateResponsibilityOrderInput = z.infer<typeof createResponsibilityOrderSchema>;
export type UpdateResponsibilityOrderInput = z.infer<typeof updateResponsibilityOrderSchema>;
export type ResponsibilityOrderFilters = z.infer<typeof responsibilityOrderFilterSchema>;
export type PrepareResponsibilityOrderForSigningInput = z.infer<
  typeof prepareResponsibilityOrderForSigningSchema
>;
export type SignResponsibilityOrderInput = z.infer<typeof signResponsibilityOrderSchema>;
export type AnnulResponsibilityOrderInput = z.infer<typeof annulResponsibilityOrderSchema>;
export type ReplaceResponsibilityOrderInput = z.infer<typeof replaceResponsibilityOrderSchema>;
export type ResponsibilityAppointmentReadModel = z.infer<
  typeof responsibilityAppointmentReadModelSchema
>;
export type ResponsibilityAppointmentFilters = z.infer<
  typeof responsibilityAppointmentFilterSchema
>;
export type MyResponsibilityOrderItem = z.infer<typeof myResponsibilityOrderItemSchema>;
