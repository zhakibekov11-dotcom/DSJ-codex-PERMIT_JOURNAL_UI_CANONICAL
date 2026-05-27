import type { UserRole } from "@dsj/types";

export type AuthenticatedUser = {
  userId: string;
  companyId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
};

