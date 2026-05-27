import { z } from "zod";

export const correspondenceKindSchema = z.enum(["LETTER", "COMMERCIAL_PROPOSAL"]);

export const correspondenceStatusSchema = z.enum([
  "DRAFT",
  "READY_TO_SEND",
  "PARTIALLY_SENT",
  "SENT",
  "ARCHIVED",
]);

export const correspondenceRecipientStatusSchema = z.enum(["PENDING", "SENT", "FAILED"]);

export const correspondenceRecipientInputSchema = z.object({
  companyName: z.string().min(2).max(255),
  contactName: z.string().min(2).max(255),
  contactEmail: z.string().email().max(255).nullable().optional(),
  contactPosition: z.string().max(255).nullable().optional(),
});

export const createCorrespondenceSchema = z.object({
  companyId: z.string().optional(),
  title: z.string().min(3).max(255),
  kind: correspondenceKindSchema,
  subject: z.string().min(3).max(255),
  body: z.string().min(20).max(20000),
  recipients: z.array(correspondenceRecipientInputSchema).min(1).max(50),
});

export const correspondenceFilterSchema = z.object({
  companyId: z.string().optional(),
  kind: correspondenceKindSchema.optional(),
  status: correspondenceStatusSchema.optional(),
  search: z.string().optional(),
});

export const correspondenceRecipientSchema = correspondenceRecipientInputSchema.extend({
  id: z.string(),
  status: correspondenceRecipientStatusSchema,
  sentAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export const correspondenceSummarySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  createdByUserId: z.string(),
  registryNumber: z.string(),
  title: z.string(),
  kind: correspondenceKindSchema,
  subject: z.string(),
  status: correspondenceStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  sentAt: z.string().nullable(),
  createdByUserName: z.string(),
  recipientsCount: z.number().int().min(0),
  recipients: z.array(correspondenceRecipientSchema),
});

export const correspondenceAiModeSchema = z.enum(["DRAFT", "IMPROVE", "ANALYZE"]);

export const correspondenceAiAssistSchema = z.object({
  companyId: z.string().optional(),
  mode: correspondenceAiModeSchema,
  kind: correspondenceKindSchema,
  subject: z.string().max(255).optional(),
  body: z.string().max(20000).optional(),
  recipientCompanyName: z.string().max(255).optional(),
  recipientContactName: z.string().max(255).optional(),
});

export const correspondenceAiResponseSchema = z.object({
  provider: z.string(),
  isFallback: z.boolean(),
  suggestedSubject: z.string(),
  suggestedBody: z.string(),
  analysis: z.string(),
});

export type CorrespondenceKind = z.infer<typeof correspondenceKindSchema>;
export type CorrespondenceStatus = z.infer<typeof correspondenceStatusSchema>;
export type CorrespondenceRecipientStatus = z.infer<typeof correspondenceRecipientStatusSchema>;
export type CorrespondenceRecipientInput = z.infer<typeof correspondenceRecipientInputSchema>;
export type CreateCorrespondenceInput = z.infer<typeof createCorrespondenceSchema>;
export type CorrespondenceFilters = z.infer<typeof correspondenceFilterSchema>;
export type CorrespondenceRecipient = z.infer<typeof correspondenceRecipientSchema>;
export type CorrespondenceSummary = z.infer<typeof correspondenceSummarySchema>;
export type CorrespondenceAiMode = z.infer<typeof correspondenceAiModeSchema>;
export type CorrespondenceAiAssistInput = z.infer<typeof correspondenceAiAssistSchema>;
export type CorrespondenceAiResponse = z.infer<typeof correspondenceAiResponseSchema>;
