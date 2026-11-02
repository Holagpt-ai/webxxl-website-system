# Session Handoff

**Compiled:** 2026-11-02 · **Repository:** `Holagpt-ai/webxxl-website-system` · **Owner:** Cursor (Batch 39A BOM repair)

## Canonical checkpoint (six-field)

| # | Field | Value |
|---|---|---|
| 1 | Last verified checkpoint | **Batch 39A** BOM strip + CI guard **IN PR**; staging P3018 documented |
| 2 | GitHub SHA, branch, active PR | `965eca9…` on `main`; branch `batch39a-migration-bom-repair` |
| 3 | Production deployment | Unchanged · **`txfxeehglqfszletuumn` not accessed** |
| 4 | Last updated | 2026-11-02 |
| 5 | Next task / responsible platform | **Owner** merge 39A → staging recovery per `BATCH39A-STAGING-MIGRATION-BOM-RECOVERY.md` |
| 6 | Open blocker / gate IDs | Staging `_prisma_migrations` failed row; **0/39** applied |

## This session

Removed UTF-8 BOM from **2** migration SQL files; added `UTF8_BOM_IN_SQL` ordering guard + CI `release:readiness --verify-ordering`; staging recovery runbook; read-only staging inventory (`_prisma_migrations` only). **No** DB writes, migrate, or production.

## Next assignment

1. Merge Batch **39A** PR.
2. Staging: `pnpm exec prisma migrate resolve --rolled-back 20251008120000_customer_portal_core`
3. Staging: `pnpm exec prisma migrate deploy` from `.env.staging.local`.
