import assert from "node:assert/strict";
import { test } from "node:test";
import { getEmployeeSigningReadiness } from "../lib/employee-signing-readiness";
import {
  buildWorkSitesManageHref,
  normalizeSafeReturnPath,
} from "../lib/safe-return-path";

test("employee signing readiness distinguishes ready, missing, and wrong accounts", () => {
  assert.equal(
    getEmployeeSigningReadiness({
      hasAccount: true,
      accountRole: "EMPLOYEE_SIGNER",
      hasEmployeeSignerAccount: true,
    }).key,
    "ready",
  );
  assert.equal(getEmployeeSigningReadiness({ hasAccount: false }).key, "missing-account");
  assert.equal(
    getEmployeeSigningReadiness({
      hasAccount: true,
      accountRole: "COMPANY_ADMIN",
      hasEmployeeSignerAccount: false,
    }).key,
    "wrong-account",
  );
});

test("returnTo accepts allowlisted internal routes and rejects external redirects", () => {
  assert.equal(
    normalizeSafeReturnPath("/journal/record-1?companyId=company-1"),
    "/journal/record-1?companyId=company-1",
  );
  assert.equal(normalizeSafeReturnPath("https://evil.example/journal/1"), null);
  assert.equal(normalizeSafeReturnPath("//evil.example/journal/1"), null);
  assert.equal(normalizeSafeReturnPath("/\\evil.example/journal/1"), null);
  assert.equal(normalizeSafeReturnPath("/api/private"), null);
});

test("work-site management link preserves a validated return route", () => {
  assert.equal(
    buildWorkSitesManageHref("company-1", "/permits/new?companyId=company-1"),
    "/work-sites?companyId=company-1&returnTo=%2Fpermits%2Fnew%3FcompanyId%3Dcompany-1",
  );
});
