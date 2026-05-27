import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user.type";

export type CanonicalScopeRequest = {
  organizationId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
};

export type CanonicalScope = {
  organizationId: string;
  branchId?: string | null;
  departmentId?: string | null;
  workSiteId?: string | null;
};

function forbidden(message: string) {
  return new ForbiddenException(message);
}

export function getCompanyScope(
  user: AuthenticatedUser,
  requestedCompanyId?: string | null,
) {
  if (user.role === "SUPER_ADMIN") {
    return requestedCompanyId ?? undefined;
  }

  if (!user.companyId) {
    throw forbidden("Требуется контекст компании.");
  }

  if (requestedCompanyId && requestedCompanyId !== user.companyId) {
    throw forbidden("У вас нет доступа к этой компании.");
  }

  return user.companyId;
}

export function assertCompanyAccess(user: AuthenticatedUser, companyId: string) {
  if (user.role === "SUPER_ADMIN") {
    return;
  }

  if (user.companyId !== companyId) {
    throw forbidden("У вас нет доступа к этой компании.");
  }
}

export function requireCompanyScope(
  user: AuthenticatedUser,
  requestedCompanyId?: string | null,
) {
  const companyId = getCompanyScope(user, requestedCompanyId);

  if (!companyId) {
    throw forbidden("Для этого действия нужно выбрать конкретную компанию.");
  }

  return companyId;
}

export function getOrganizationScope(
  user: AuthenticatedUser,
  requestedOrganizationId?: string | null,
) {
  return getCompanyScope(user, requestedOrganizationId);
}

export function assertOrganizationAccess(
  user: AuthenticatedUser,
  organizationId: string,
) {
  return assertCompanyAccess(user, organizationId);
}

export function requireOrganizationScope(
  user: AuthenticatedUser,
  requestedOrganizationId?: string | null,
) {
  return requireCompanyScope(user, requestedOrganizationId);
}

export function resolveCanonicalScope(
  user: AuthenticatedUser,
  requestedScope?: CanonicalScopeRequest | null,
): CanonicalScope {
  const organizationId = requireOrganizationScope(user, requestedScope?.organizationId ?? null);

  return {
    organizationId,
    branchId: requestedScope?.branchId ?? null,
    departmentId: requestedScope?.departmentId ?? null,
    workSiteId: requestedScope?.workSiteId ?? null,
  };
}

export function assertScopeAccess(user: AuthenticatedUser, scope: CanonicalScope) {
  assertOrganizationAccess(user, scope.organizationId);
}
