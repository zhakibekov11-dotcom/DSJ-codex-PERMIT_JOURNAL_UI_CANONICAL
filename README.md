# DSJ Wrapper Root

DSJ is a Kazakhstan-focused digital safety and compliance platform.

This repository root is a thin wrapper. The active monorepo lives in `dsj2/`, and the business-level overview is in [`dsj2/README.md`](./dsj2/README.md).

## Start Here

Before editing code, open:

1. `dsj2/README.md`
2. `dsj2/docs/context/start-here-for-codex.md`
3. `dsj2/docs/context/current-product-status.md`
4. The nearest `AGENTS.md` under `dsj2/`

## Common Commands

Run everything from `dsj2/`:

```bash
cd dsj2
corepack enable && pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm build:api:deploy
pnpm build:worker:deploy
```

## Current Validation Reality

- `pnpm verify` is the current compile/build gate.
- Root `pnpm lint` and `pnpm test` intentionally exit with placeholder messages because package-level lint/test tasks are not configured yet.

## What Lives In The Wrapper

- `dsj2/` - the active DSJ workspace.
- `doc/` and `packages/` at the wrapper root are legacy/wrapper surfaces unless a task explicitly targets them.

## Source Of Truth

- Code and package scripts in `dsj2/` are authoritative.
- If docs conflict with `package.json`, `pnpm-workspace.yaml`, or `turbo.json`, trust the code and scripts.
