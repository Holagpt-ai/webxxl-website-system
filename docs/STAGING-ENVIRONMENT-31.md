# Staging environment configuration (Batch 31 — preparation only)

**Purpose:** Document the **exact reproducible binding** for a controlled WebXXL staging pilot. **No** infrastructure was provisioned in Batch 31.

## Current evidence (2026-11-02)

| Component | State |
|---|---|
| Isolated staging Postgres/Supabase | **IDENTIFIED** — Supabase project `vcgibefnhneaqhcguhnt` (see [`STAGING-SUPABASE-BINDING.md`](STAGING-SUPABASE-BINDING.md)); credentials **host-only** |
| Production Supabase (collision guard only) | Project `txfxeehglqfszletuumn` — fingerprint in `WEBXXL_PRODUCTION_DATABASE_IDENTITY`; **never** bind staging URLs to this project |
| WebXXL staging/preview app | Vercel Preview deploys app SHA; **does not** imply isolated DB until env vars bound |
| INFRA-02 isolated services (Chatwoot/Postiz/Paperclip) | Compose manifests ready; **live staging BLOCKED** per [`infra/services/shared/STAGING-GATE.md`](../infra/services/shared/STAGING-GATE.md) |

## Required owner binding (when authorized)

### 1. Database

```env
# Staging-only — never commit literals (full template: infra/services/shared/webxxl-staging-database.env.example)
WEBXXL_STAGING_DATABASE_IDENTITY=supabase:vcgibefnhneaqhcguhnt/postgres
WEBXXL_PRODUCTION_DATABASE_IDENTITY=supabase:txfxeehglqfszletuumn/postgres
DATABASE_URL=postgresql://postgres.vcgibefnhneaqhcguhnt:<staging-password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.vcgibefnhneaqhcguhnt:<staging-password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

`DATABASE_URL` and `DIRECT_URL` must reference the **same authorized Supabase project** (project ref in `postgres.{ref}` for Session Pooler). Preflight identity is `supabase:{ref}/postgres`, not the shared pooler hostname.

After independent verification that this identity is not production:

```env
WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1
```

Vercel **Preview** or **Staging** project environment variables must reference the staging host only. Production Supabase project ID must differ.

### 2. Application

```env
WEBXXL_STAGING_APP_URL=https://<preview-or-staging-host>
AUTH_URL=https://<same-host>
AUTH_SECRET=<staging-secret>
```

Copy patterns from [`infra/services/shared/webxxl-staging.env.example`](../infra/services/shared/webxxl-staging.env.example).

### 3. Module flags (staging only — examples)

Keep **OFF** until migrations + OPEN-001 evidence exist:

```env
CRM_BACKEND_ENABLED=1
SITE_LEAD_INTAKE_ENABLED=1
MKT_BACKEND_ENABLED=0
SEO_BACKEND_ENABLED=0
COMMS_BACKEND_ENABLED=0
ANALYTICS_BACKEND_ENABLED=0
```

Provider/outbound flags (`POSTIZ_LIVE_PUBLISHING_ENABLED`, `SMS_SEND_ENABLED`, etc.) remain **0** unless separately authorized.

### 4. Verification commands (read-only / safe)

```bash
pnpm migration:rehearsal
pnpm migration:rehearsal --verify-db
pnpm synthetic-pilot:report
export DATABASE_URL="…staging…"
export DIRECT_URL="…staging…"
export WEBXXL_STAGING_DATABASE_IDENTITY="host:port/dbname"
PILOT_READINESS_DB_PROBE=1 pnpm pilot:readiness
```

`prisma migrate deploy` (owner-authorized, not run from this batch) always applies the **full** pending migration chain. The rehearsal `--foundation` flag filters the report only.

## Missing owner authorization (recorded)

- Staging database **password** and host-only env file (not in repo).
- `WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1` after verifying project refs differ.
- Staging snapshot; then authorized `prisma migrate deploy` on staging only.
- Bind Vercel staging/preview to staging database env vars.
- Optional: INFRA-02 VPS `staging-up` for Chatwoot/Postiz — separate from WebXXL app DB.
