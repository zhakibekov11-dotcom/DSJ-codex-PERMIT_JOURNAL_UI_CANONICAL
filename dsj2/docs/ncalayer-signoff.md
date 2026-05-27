# NCALayer Integration Sign-Off

Date: 2026-04-10

## Scope Completed

- Added an in-repo local bridge service in `apps/ncalayer-bridge`.
- Unified admin signing, employee self-service signing, and public invite signing onto one provider-aware contract.
- Enabled `SIGNING_PROVIDER=NCALAYER` with explicit bridge URL and timeout configuration.
- Added server-side digest, certificate metadata, and signer-IIN validation.
- Persisted provider-specific signing payload into `Signature.payload`.
- Updated flow documentation and current functionality audit to reflect the implemented state.

## Enabled Flows

- Admin signing page: uses the shared signing form and unified `/sign` API path.
- Employee self-service signing: uses the same provider-aware contract as admin and public invite signing.
- Public invite signing: uses the same provider-aware contract and backend `signingAvailable` gating.
- Mock flow: remains available only as an explicit fallback/dev path.

## External Dependencies

- Installed NCALayer desktop runtime on the signer machine.
- Local bridge process running on the signer machine and reachable at `NCALAYER_BRIDGE_URL`.
- End-user certificate estate and operational/legal acceptance outside the repository.

## Required Environment Variables

- `SIGNING_PROVIDER`
- `NCALAYER_BRIDGE_URL`
- `NCALAYER_BRIDGE_TIMEOUT_MS`
- `SIGNING_TEST_MODE`

Related fallback flag:

- `ALLOW_PUBLIC_INVITE_MOCK_SIGNING`

## Checks Run

- `corepack pnpm db:generate`
- `corepack pnpm typecheck`
- `API_URL=http://localhost:4000 corepack pnpm build`
- `corepack pnpm exec tsx --test "apps/api/src/signatures/signatures.service.wave1.test.ts"`
- `corepack pnpm exec tsx --test "apps/web/app/**/*.wave1.test.tsx"`
- `corepack pnpm --filter @dsj/ncalayer-bridge build`
- `corepack pnpm --filter @dsj/ncalayer-bridge test`

## Residual Limits

- DSJ now implements the NCALayer bridge/service path, but the actual signature ceremony still depends on the external NCALayer runtime being installed and reachable.
- Public invite mock signing is still intentionally gated and is not the production path.
- Root `pnpm lint` and root `pnpm test` remain placeholder scripts in this repository and were not used as release gates.
- The web production build still expects `API_URL` to be set explicitly.

## Role Sign-Off

- Backend: signed off for repository scope. Unified contract, digest validation, certificate metadata checks, signer-IIN verification, and provider payload persistence are implemented.
- Frontend: signed off for repository scope. Admin, employee, and public invite flows use the shared signing form without adding provider-selection UI.
- QA: signed off for repository scope. Targeted API tests, web wave tests, bridge smoke tests, typecheck, build, and db generate completed.
- Owner: signed off for repository handoff scope. Remaining blockers are external runtime and certificate operations, not missing repository implementation.
