import { z } from "zod";

export const contractorCompanySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string().min(2),
  bin: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
});

const contractorCompanyInputSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(2),
  bin: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createContractorCompanySchema = contractorCompanyInputSchema;

export const updateContractorCompanySchema = contractorCompanyInputSchema.extend({
  isActive: z.boolean().optional(),
});

export type ContractorCompany = z.infer<typeof contractorCompanySchema>;
export type CreateContractorCompanyInput = z.infer<typeof createContractorCompanySchema>;
export type UpdateContractorCompanyInput = z.infer<typeof updateContractorCompanySchema>;
