# API Area Rules

Use this after `.mempalace/index.json` when a task touches `apps/api`.

Read first:

- `apps/api/README.md`
- the relevant `.mempalace/features/*.json` card when the task names a feature
- the specific controller, service, schema, provider, or module being changed

## Rules

- Derive company scope from the authenticated user, not from request body fields.
- Use `CurrentUser`, `Roles`, `JwtAuthGuard`, `RolesGuard`, `getCompanyScope`, `requireCompanyScope`, `assertCompanyAccess`, and `requireEmployeeScope` where they already fit the flow.
- Keep authorization in controllers/guards and business logic in services.
- Keep request validation in schemas plus `ZodValidationPipe`; do not add ad hoc parsing in controllers.
- Treat `SUPER_ADMIN` as an explicit override, not as a default bypass.
- Keep response contracts backward compatible; update `@dsj/types` alongside API contract changes.
- Do not leak PII, signature payloads, encrypted values, auth secrets, or tenant internals in logs or responses.
- If a query or write path touches `companyId`, inspect every `findMany`, `updateMany`, `deleteMany`, and export path for cross-tenant leakage.

## Validation

- Verify with `pnpm --filter @dsj/api build` and `pnpm --filter @dsj/api typecheck`.
- If shared packages changed, verify the dependent packages too.
- If the route affects downloads, exports, or binary payloads, smoke-check the exact endpoint.

## Escalate

- Missing tenant filters on reads or writes.
- Request-driven company selection without server-side override.
- Any change to signatures, encryption, auth flow, or audit semantics.
- API responses that could expose another tenant, a signature artifact, or an employee identifier.
