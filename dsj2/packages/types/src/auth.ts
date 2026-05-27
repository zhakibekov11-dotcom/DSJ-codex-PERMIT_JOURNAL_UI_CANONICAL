import { z } from "zod";

export const userRoleSchema = z.enum([
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "SAFETY_ENGINEER",
  "EMPLOYEE_SIGNER",
]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  companyId: z.string().nullable(),
  email: z.string().email(),
  fullName: z.string(),
  role: userRoleSchema,
  hasLinkedEmployeeRecord: z.boolean().default(true),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;

