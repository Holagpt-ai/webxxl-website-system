# BATCH38 — Release readiness and staging acceptance

**Status:** **MERGED** (PR #90) · **Scope:** read-only release checks, migration ordering safeguards, staging rollout checklist, AI/workflow guardrails. **Not** production migration, deploy activation, or live providers.

**Baseline `main`:** `2656eebca7bf8b312e483165b0a0eaaa3f785322` (PR #90). Staging Supabase binding: [`STAGING-SUPABASE-BINDING.md`](STAGING-SUPABASE-BINDING.md).

## CLI (read-only)

| Command | Purpose |
|---------|---------|
| `pnpm release:readiness` | Full Batch 38 report + staging rollout checklist |
| `pnpm release:readiness --verify-ordering` | Fail if migration.sql missing; warn on duplicate timestamp prefixes |
| `PILOT_READINESS_DB_PROBE=1 pnpm release:readiness` | Include `_prisma_migrations` probe (staging only) |
| `pnpm migration:rehearsal` | Existing full-chain rehearsal plan (Batch 31) |

## Library entry points

| Module | Role |
|--------|------|
| `lib/platform/pilot/migration-ordering-safeguards.ts` | Lexicographic chain + missing SQL detection |
| `lib/platform/pilot/release-execution-guardrails.ts` | CUSTOMER_AI_* and WORKFLOW_* default-OFF checks |
| `lib/platform/pilot/staging-rollout-checklist.ts` | Merged / deployed / migrated / activated / verified matrix |
| `lib/platform/pilot/release-readiness-assess.ts` | Composes pilot readiness + Batch 38 checks |

## Staging dependencies (not provisioned in repo)

- Isolated staging PostgreSQL (see `PILOT-21C-STAGING-PREFLIGHT.md`, `STAGING-GATE.md`).
- Full pending migration chain apply on staging (`prisma migrate deploy`).
- Batch 38 release slice includes Batch 31 foundation + `ai_customer_13` + Batch 37 pilot persistence + AUTO-10 foundation folders (inventory in `batch38ReleaseMigrationFolders()`).

## Owner signoff gates

1. Migration ordering report clean (no missing SQL).
2. Staging migration probe PASS for release slice (optional full chain).
3. Execution guardrails PASS (AI + workflow worker flags OFF in staging baseline).
4. Authenticated EN/ES customer smoke recorded (VERIFIED — not inferred from CI).
5. Separate authorization before production migrate, provider activation, or LLM/workflow worker cron.

## Tests

`__tests__/platform/batch38-release-readiness.test.ts`
