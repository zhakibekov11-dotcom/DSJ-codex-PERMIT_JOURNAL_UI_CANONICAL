# DSJ Wrapper Root

The active monorepo lives in `dsj2/`.
Before editing code, read `dsj2/AGENTS.md` and the nearest local `AGENTS.md` inside that workspace.

From this root, use:

- `cd dsj2`
- `corepack enable && pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Do not edit wrapper-level files such as `README.md`, `.eslintrc.json`, or `.env.example` unless the task explicitly targets the wrapper.
