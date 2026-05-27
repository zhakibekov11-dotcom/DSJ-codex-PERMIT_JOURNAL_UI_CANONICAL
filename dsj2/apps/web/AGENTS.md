# Web Area Rules

Use this after `.mempalace/index.json` when a task touches `apps/web`.

Read first:

- `apps/web/README.md`
- the relevant `.mempalace/features/*.json` card when the task names a feature
- the specific route, action, component, or proxy files being changed

## Rules

- Use `getCurrentSession`, `requireSession`, and `requireRoleAccess` for auth gates.
- Keep UI and server contracts aligned with `@dsj/types`.
- Prefer `apiFetch` for server-side calls into the API.
- Treat `app/api/*` routes as pass-through proxies; preserve status, headers, content type, and binary bodies.
- Keep client-side validation helpful, but enforce authorization and tenant scope on the server.
- If a UI change touches shared primitives, use the repo's frontend skills as well.
- If a change crosses into API, worker, or database behavior, read those local `AGENTS.md` files before editing.

## Validation

- Verify with `pnpm --filter @dsj/web build` and `pnpm --filter @dsj/web typecheck`.
- Smoke-check the changed route, redirect, or download path.
- For auth/role changes, confirm both the login path and the destination route.

## Escalate

- Any change that duplicates backend auth logic in the client.
- Proxy routes that stop forwarding binary payloads or headers correctly.
- Shared contract changes that are not synced with API/types.
