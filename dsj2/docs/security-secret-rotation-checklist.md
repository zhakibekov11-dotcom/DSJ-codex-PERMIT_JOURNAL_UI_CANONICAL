# Security Secret Rotation Checklist

Use this checklist after deploying the hardening changes if production exposure is suspected. Do not commit live secrets or rotated values to the repository.

1. Rotate `JWT_SECRET`.
   - Generate a new 32+ character random secret in the production secret manager.
   - Deploy API with the new value.
   - Invalidate existing sessions by requiring users to log in again.

2. Rotate database credentials.
   - Create a new database user/password with the required app privileges.
   - Update `DATABASE_URL` in the deployment secret manager.
   - Deploy and verify API/worker connectivity.
   - Revoke the old database credential after successful verification.

3. Rotate field encryption and hash secrets.
   - Set a new `FIELD_HASH_PEPPER` before writing new deterministic hashes.
   - Treat `FIELD_ENCRYPTION_KEY` rotation as a planned data migration: decrypt with the old key, re-encrypt with the new key, verify row counts, then remove old-key access.
   - Run `pnpm security:backfill --dry-run` first, then `pnpm security:backfill` with a valid production `DATABASE_URL` during a maintenance window.

4. Rotate eGov and provider callback secrets.
   - Generate a new `EGOV_MOBILE_QR_CALLBACK_SECRET`.
   - Update the provider callback configuration and the app secret manager together.
   - Confirm unsigned callbacks are rejected and signed callbacks are accepted.

5. Rotate any public invite exposure.
   - Run `pnpm security:backfill` to hash legacy plaintext invite tokens and clear the raw column.
   - Reissue invite links for any briefing records believed to have been exposed.
   - Review audit logs for unusual public invite GET/POST activity.

6. Post-rotation verification.
   - Run `pnpm audit --prod`.
   - Run `pnpm --filter @dsj/database db:generate`.
   - Run `pnpm typecheck`.
   - Run `pnpm verify` with production-equivalent required env vars.
   - Run `pnpm tenant:audit` with a valid `DATABASE_URL`.
