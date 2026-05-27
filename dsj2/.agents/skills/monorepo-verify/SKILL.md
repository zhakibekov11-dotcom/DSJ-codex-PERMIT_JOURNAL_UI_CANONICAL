---
name: monorepo-verify
description: Validate cross-package changes in the DSJ pnpm/Turbo monorepo. Use when a task touches multiple apps or packages, workspace tooling, build/typecheck validation, or when Codex needs the smallest reliable install/build/smoke path after edits.
---

# Monorepo Verify

Validate cross-package DSJ changes with the smallest reliable install/build/typecheck/smoke path.

## When to use

Use for changes that touch more than one of:

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/*`
- `scripts/*`
- root build or workspace tooling

Do not use for:

- docs-only edits
- one-file typo or copy fixes
- changes that stay inside one package and do not affect contracts

## Inputs

- Changed files
- Affected packages
- Whether package scripts or workspace config changed
- Any runtime entrypoints that need a smoke-check

## Procedure

1. Read the closest `AGENTS.md` files first.
2. Identify the touched package and the downstream dependents.
3. Prefer package-scoped checks over repo-wide checks.
4. If package scripts, lockfile, or workspace config changed, run `corepack enable && pnpm install --frozen-lockfile`.
5. Run the touched package build and typecheck.
6. If shared packages changed, run their consumers too.
7. If runtime behavior changed, do a minimal smoke-check for the exact entrypoint.
8. Report the commands you ran and any residual risk.

## Required checks

- `pnpm --filter <pkg> build` or `pnpm --filter <pkg> typecheck` for each touched package
- `pnpm build` when the change spans shared contracts or workspace tooling
- one manual smoke path for runtime-affecting changes

## Outputs

- Command log
- Pass/fail summary
- Any downstream packages that needed a follow-up check
- Any residual risk that remains because the repo has weak or missing tests

## Red flags

- Build passes but typecheck fails
- A downstream package stops compiling
- Generated files drift from source
- A doc lists a script that does not exist in `package.json`
- Smoke-check cannot reach the changed entrypoint
