const allowedReturnPrefixes = [
  "/employees",
  "/journal",
  "/training",
  "/protocols",
  "/orders/responsibility",
  "/permits",
  "/work-sites",
];

export function normalizeSafeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(candidate, "http://dsj.internal");
    const isAllowedPath = allowedReturnPrefixes.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    );

    if (parsed.origin !== "http://dsj.internal" || !isAllowedPath) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildWorkSitesManageHref(
  companyId: string | null | undefined,
  returnTo: string,
) {
  const params = new URLSearchParams();
  const safeReturnTo = normalizeSafeReturnPath(returnTo);

  if (companyId) {
    params.set("companyId", companyId);
  }

  if (safeReturnTo) {
    params.set("returnTo", safeReturnTo);
  }

  const query = params.toString();
  return query ? `/work-sites?${query}` : "/work-sites";
}
