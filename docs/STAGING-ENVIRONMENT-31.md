# Staging environment configuration (Batch 31 — preparation only)

**Purpose:** Document the **exact reproducible binding** for a controlled WebXXL staging pilot. **No** infrastructure was provisioned in Batch 31.

## Current evidence (2026-10-31)

| Component | State |
|---|---|
| Isolated staging Postgres/Supabase | **NOT IDENTIFIED** — no `STAGING_DATABASE_URL` / `WEBXXL_STAGING_DATABASE_URL` in repo |
| WebXXL staging/preview app | Vercel Preview deploys app SHA; **does not** imply isolated DB |
| INFRA-02 isolated services (Chatwoot/Postiz/Paperclip) | Compose manifests ready; **live staging BLOCKED** per [`infra/services/shared/STAGING-GATE.md`](../infra/services/shared/STAGING-GATE.md) |

## Required owner binding (when authorized)

### 1. Database

```env
# Staging-only — never commit literals
STAGING_DATABASE_URL=postgresql://…/webxxl_staging?schema=public
DIRECT_URL=postgresql://…/webxxl_staging?schema=public
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
pnpm synthetic-pilot:report
PILOT_READINESS_DB_PROBE=1 DATABASE_URL="$STAGING_DATABASE_URL" pnpm pilot:readiness
```

## Missing owner authorization (recorded)

- Create or designate isolated staging database project.
- Bind Vercel staging/preview to that database.
- Optional: INFRA-02 VPS `staging-up` for Chatwoot/Postiz — separate from WebXXL app DB.
