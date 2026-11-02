# Staging Supabase binding (preparation — no migrate in repo)

**Baseline `main`:** `2656eebca7bf8b312e483165b0a0eaaa3f785322` (PR #90 merged).  
**Scope:** Document staging-only database env binding and read-only preflight. **No** production access, **no** `prisma migrate deploy` from this preparation.

## Identified projects (owner-supplied)

| Role | Supabase project ref | Preflight identity (no secrets) |
|---|---|---|
| Production | `txfxeehglqfszletuumn` | `supabase:txfxeehglqfszletuumn/postgres` |
| Isolated staging | `vcgibefnhneaqhcguhnt` | `supabase:vcgibefnhneaqhcguhnt/postgres` |

Legacy direct-host evidence (`db.{ref}.supabase.co:5432/postgres`) normalizes to the same `supabase:{ref}/postgres` form.

Credentials are **not** stored in the repository. Obtain the staging database password only from the **staging** project dashboard.

## Session Pooler (owner network evidence)

When `db.vcgibefnhneaqhcguhnt.supabase.co:5432` does not resolve, use **Session mode** on port **5432**:

```text
postgresql://postgres.vcgibefnhneaqhcguhnt:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Preflight resolves the authorized target from **`postgres.{project-ref}`** in the username, not the shared pooler hostname. Production collision checks use `WEBXXL_PRODUCTION_DATABASE_IDENTITY` (`supabase:txfxeehglqfszletuumn/postgres`).

## Required environment variables

Host-only template: [`infra/services/shared/webxxl-staging-database.env.example`](../infra/services/shared/webxxl-staging-database.env.example).

| Variable | Purpose |
|---|---|
| `WEBXXL_STAGING_DATABASE_IDENTITY` | `supabase:vcgibefnhneaqhcguhnt/postgres` (or legacy direct-host fingerprint). |
| `WEBXXL_PRODUCTION_DATABASE_IDENTITY` | Collision guard — must differ from staging. |
| `DATABASE_URL` | Staging Postgres URL; same **Supabase project ref** as `DIRECT_URL`. |
| `DIRECT_URL` | Same authorized project as `DATABASE_URL`; for Prisma migrate when direct host is down, use the **same Session Pooler URI** as `DATABASE_URL`. |
| `WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1` | Operator attestation; required for `--verify-db` and migrate runbook. |

### Prisma note

- **Do not** pair transaction pooler (`:6543`) with direct host — refs will not match and migrations may fail.
- When direct `db.*` is unreachable, bind **both** URLs to Session Pooler `:5432` with `postgres.{staging-ref}`.

## Verification (read-only)

```bash
pnpm migration:rehearsal --verify-db
PILOT_READINESS_DB_PROBE=1 pnpm release:readiness
```

Stop before `pnpm exec prisma migrate deploy` until snapshot + owner authorization.

## Related docs

- [`STAGING-ENVIRONMENT-31.md`](STAGING-ENVIRONMENT-31.md)
- [`BATCH38-RELEASE-READINESS.md`](BATCH38-RELEASE-READINESS.md)
- [`PILOT-21C-STAGING-PREFLIGHT.md`](PILOT-21C-STAGING-PREFLIGHT.md)
