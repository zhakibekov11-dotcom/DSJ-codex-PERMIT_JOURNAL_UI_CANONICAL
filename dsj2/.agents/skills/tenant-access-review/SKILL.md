---
name: tenant-access-review
description: Review tenant-scoped, role-gated, PII, signature, and employee-access changes in DSJ. Use when editing NestJS controllers/services, Prisma queries, auth redirects, or any flow that could cross company boundaries.
---

# Tenant Access Review

Review company-scoped and role-gated changes before they leak data across tenants.

## When to use

Use for:

- NestJS controllers, services, guards, and decorators
- Prisma queries that depend on `companyId`, `userId`, employee scope, or role
- Signature, encryption, PII, audit, export, or notification flows
- Web auth redirects that decide who can reach a page

Do not use for pure styling or contract-neutral refactors.

## Inputs

- File list
- Routes or services being changed
- Role matrix involved in the flow
- Any company/employee identifiers that enter or leave the system

## Procedure

1. Trace the request from entrypoint to database write.
2. Confirm company scope comes from the authenticated user, not from request body fields.
3. Use the existing helpers where they already fit: `CurrentUser`, `Roles`, `getCompanyScope`, `requireCompanyScope`, `assertCompanyAccess`, `requireEmployeeScope`.
4. Check every `findMany`, `updateMany`, `deleteMany`, export path, and include graph for tenant filters.
5. Confirm that `SUPER_ADMIN` is an explicit override and nothing else bypasses scope.
6. Check that responses do not leak another tenant, a signature artifact, an encrypted value, or an employee identifier that should stay masked.
7. Sync the web role gate with the API authorization if the UI changed too.
8. Run the smallest build/typecheck/smoke path that covers the touched flow.

## Required checks

- `pnpm --filter @dsj/api typecheck`
- The smallest affected build path
- One manual request or browser smoke for the changed role/tenant path

## Outputs

- A list of affected tenants and roles
- Every cross-tenant read/write path you verified
- Any required approval point before merge

## Red flags

- Request body contains `companyId` without server-side override
- A query filters by a non-tenant key and returns tenant data
- `findUnique` or `include` expands to another company without checks
- Export/download routes omit a scope check
- Signature payloads, encrypted values, or masked employee identifiers are exposed directly
- UI and API disagree on the role gate
