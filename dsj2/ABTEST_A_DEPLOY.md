# ABTEST-A Deploy

This repo already supports branch-scoped deployment through env values. The minimum change for `ABTEST-A` is to keep the code on `main`, deploy the branch separately, and give that branch its own public URLs and secrets.

## What Runs Where

- `Vercel`: `apps/web`
- `Railway`: `apps/api`
- `Railway worker`: only keep it shared if `ABTEST-A` intentionally shares the same DB/Redis contour; do not create a second worker unless you also split the data layer

## Production

Use the current `main` deployment values.

Required envs:

- `APP_URL` = production frontend URL
- `API_URL` = production API URL
- `CORS_ORIGIN` = browser origin allowed by the API, defaults to `APP_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `REDIS_URL` if the worker is running

No OAuth, callback, or webhook URL envs were found in the current codebase, so there is nothing separate to configure there right now.

Keep these explicit:

- `ALLOW_PUBLIC_INVITE_MOCK_SIGNING=false`
- `SEED_ALLOW_DESTRUCTIVE_RESET=false`
- `COOKIE_NAME=dsj_session` unless you have a reason to change it

## ABTEST-A

Use separate values for the branch deployment.

Required envs:

- `APP_URL=https://abtest-a.example.com`
- `API_URL=https://api-abtest-a.example.com`
- `CORS_ORIGIN=https://abtest-a.example.com`
- `DATABASE_URL` for the A/B database if you want isolation
- `JWT_SECRET` different from production
- `FIELD_ENCRYPTION_KEY` different from production
- `REDIS_URL` different from production if you want queue isolation

Keep these aligned with the intended contour:

- `ALLOW_PUBLIC_INVITE_MOCK_SIGNING=false`
- `SEED_ALLOW_DESTRUCTIVE_RESET=false`
- `SIGNING_PROVIDER`, `NCALAYER_BRIDGE_URL`, `NCALAYER_BRIDGE_TIMEOUT_MS`, `SIGNING_TEST_MODE` should match the contour you actually want; do not invent a new signing architecture for this branch
- `OPENAI_API_KEY` and `OPENAI_MODEL` can stay the same unless the branch intentionally tests another model/key

There are no OAuth, callback, or webhook URL envs in the current codebase, so no extra branch-specific values are required for those flows.

## What Must Differ

At minimum, these values must not be shared between production and `ABTEST-A`:

- `APP_URL`
- `API_URL`
- `CORS_ORIGIN` if the allowed browser origin is not the same as `APP_URL`
- `DATABASE_URL` if the branch must not touch production data
- `JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `REDIS_URL` if you need queue/job isolation

## Manual Setup

### Vercel

- Keep production on `main`
- Add branch-scoped env values for `ABTEST-A`
- Point the branch frontend to `apps/web`
- Use the branch URL as `APP_URL`
- Use the branch API URL as `API_URL`
- Set `CORS_ORIGIN` to the exact browser origin the API should allow

### Railway

- Create a separate API service for `ABTEST-A` if you need separate URLs or secrets
- Set `APP_URL` to the branch frontend URL
- Set `CORS_ORIGIN` to the branch frontend origin if it differs from `APP_URL`
- Set `DATABASE_URL`, `JWT_SECRET`, and `FIELD_ENCRYPTION_KEY` to branch-specific values
- Set `REDIS_URL` separately if the worker should not touch production jobs

## Shared DB Risk

If `ABTEST-A` uses the same PostgreSQL database as production, it is not isolated.

That means:

- branch writes will hit production data
- migrations will affect both contours
- destructive seed logic can damage production if misused
- queue/reminder state will be shared if `REDIS_URL` is also shared

If you need hard isolation, use a separate database. If you only need a separate UI rollout with the same data, the shared DB is acceptable but it is a real risk.

## Example Domains

- production frontend: `app.example.com`
- production backend: `api.example.com`
- ABTEST-A frontend: `abtest-a.example.com`
- ABTEST-A backend: `api-abtest-a.example.com`

## Example Env File

See [`.env.abtest.example`](./.env.abtest.example) for a branch-scoped template.
