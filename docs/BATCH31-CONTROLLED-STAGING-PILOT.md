# Batch 31 — Controlled staging readiness + core customer pilot foundation

**Status:** IN PR until merged. **No** production migrations, flag activation, provider provisioning, or live customer data mutation.

**Baseline `main`:** `3a7d011466aeabcf4c2d3bdfe8a669d42e448957` (PR #81 / Batch 30C merged).

## WS1 — Staging environment

| Finding | Evidence |
|---|---|
| Isolated staging DB + app | **NOT IDENTIFIED** in repository or default CI (reconfirms [`PILOT-21C-STAGING-PREFLIGHT.md`](PILOT-21C-STAGING-PREFLIGHT.md)). |
| Reproducible artifacts | [`STAGING-ENVIRONMENT-31.md`](STAGING-ENVIRONMENT-31.md), `infra/services/shared/webxxl-staging.env.example`, `infra/services/shared/STAGING-GATE.md`. |
| Owner authorization | Dedicated staging Postgres/Supabase + Vercel env binding; INFRA-02 VPS gate unchanged. |

Assessment helper: `lib/platform/pilot/staging-environment-assess.ts` (`assessStagingEnvironment()`).

## WS2 — Migration dependency readiness

| Deliverable | Location |
|---|---|
| Full ordered plan + risk hints | `lib/platform/pilot/migration-dependency-matrix.ts` |
| Pilot module folders (incl. 28A leads, FOUND-01) | `lib/platform/pilot/migration-prerequisites.ts` |
| Rehearsal procedure (read-only CLI) | `pnpm migration:rehearsal` → `scripts/migration-rehearsal.ts` |
| Production migration state | **UNVERIFIED** unless `PILOT_READINESS_DB_PROBE=1` against authorized staging DB |

Priority for customer pilot foundation: FOUND-01 → CRM → Batch **28A/28A.2** site leads → analytics/marketing as needed.

## WS3 — Synthetic customer pilot

| Element | Location |
|---|---|
| Scenario (2 accounts, 1 BillingGroup, multi-site) | `lib/platform/pilot/synthetic-customer-pilot-workflow.ts` |
| Operator summary CLI | `pnpm synthetic-pilot:report` |
| Automation | Vitest: `batch31-staging-pilot-readiness.test.ts` + existing `pilot21a`, `batch28a*`, `batch30a`, `batch30c`, `batch27a-1`, `open001` |

## WS4 — Feature readiness matrix

`lib/platform/pilot/feature-readiness-matrix.ts` — distinguishes **disabled**, **not_configured**, **policy_unresolved**, **unauthorized**, **ready_pending_migration**, **ready_pending_data** for CRM, lead intake, Marketing, SEO, Analytics, Communications, Business Command Center.

Source-default flags remain **OFF** in CI and production unless separately authorized.

## WS5 — Validation

Focused tests only (see CI `app-validate.yml`). Not a RELEASE-14 acceptance run.

## Owner approvals before staging execution

1. Isolated staging database (not production `DATABASE_URL`).
2. `prisma migrate deploy` on staging (full chain or foundation slice per operator plan).
3. Per-module backend flags on **staging only** (CRM, MKT, SEO, COMMS, ANALYTICS) — one module at a time or together per owner plan.
4. `SITE_LEAD_INTAKE_ENABLED` on staging only after 28A migrations applied.
5. Provision **new** pilot CustomerAccounts + website subscription evidence (do not mutate ABMED Vitest fixtures in shared DB).
6. Authenticated EN/ES manual smoke on staging/preview URL.

## Next consolidated workstream (proposed)

**Batch 32** — Commerce & wallet fulfillment (see `docs/PROJECT_MEMORY.md` proposed roadmap) after owner selects staging pilot vs commerce priority.
