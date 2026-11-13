# Batch 8A — Release readiness & baseline recovery

**Status:** IN PR (owner review) · **PR [#131](https://github.com/Holagpt-ai/webxxl-website-system/pull/131)** @ `bee07d6` · **Base `main`:** `8058565e11fed8927147c54e2b4ee0a58cc184bf` (PR **#130** Batch 7C MERGED)

## Release gate outcomes (`pnpm release:readiness` @ `8058565`)

| Outcome | Items |
|---|---|
| **PASS** | OPEN-001 subscriber gates; module/provider flags source-default OFF; migration ordering (39 folders); Batch 38 execution guardrails (AI + workflow OFF); isolation modules present |
| **BLOCKED** | Pilot migration DB probe; authenticated customer pilot smoke (needs staging session) |
| **UNVERIFIED** | Operational pilot capability in live env; staging isolated DB identity; production migration apply |

`pnpm release:readiness --verify-ordering`: **PASS** with advisory `DUPLICATE_TIMESTAMP_PREFIX` on `20261031120000_*` (documented; not auto-fixed).

## Baseline test recovery (pre-8A)

| ID | Root cause | Class | Fix |
|---|---|---|---|
| INFRA-02 example env | Staging URL used `YOUR_STAGING_DB_PASSWORD` (failed secret-pattern scan) | **Test harness / example doc** | `PLACEHOLDER_STAGING_DB_PASSWORD` in `webxxl-staging-database.env.example` |
| CRM-05 segment summary | `summarizeSegmentPopulation` excludes suppressed contacts from unknown-consent count (160 not 180) | **Test expectation drift** | Align fixture assertion to 160 |
| FOUND-01B partial settle | `settle()` used wall-clock `Date` after reservation `expiresAt` passed in 2026 | **Engineering defect** | Optional `at` on `SettleCreditsInput`; test passes explicit timeline |
| SOCIAL-04A campaign quota | Vitest node resolver could not resolve `next/server` from nested `next-auth` | **Test harness** | `server.deps.inline: ['next-auth']` in `vitest.config.ts`; mock subscriber evidence in test |

## Release blocker inventory

| ID | Type | State | Next action |
|---|---|---|---|
| RELEASE-001 | Owner gate | REPORTED | Batch 8B staging acceptance after 8A merge |
| Issue #105 CRM QA (remainder) | Deferred acceptance | DEFERRED → Batch 8 | Bounded staging matrix (8B); not reopening PR #106 entitlement |
| CRM-SUBNAV-105 | UI report | REPORTED | Verify in 8B nav smoke only |
| POLICY-SUB-001 | Owner policy | REPORTED | Grace-period decision — owner |
| Production migration proof | Environment | UNVERIFIED | Owner-authorized `prisma migrate deploy` evidence only |
| Staging migrations 39/39 | Historical | **Last recorded 2026-11-03** — not re-counted in 8A | `PILOT_READINESS_DB_PROBE=1` on authorized staging |
| `hello@webbxxl.com` mailbox | Operations | UNVERIFIED | Batch 8B/C owner verification |
| Staging credential rotation | Operations | Owner follow-up | No credential changes in 8A |
| Provider / AI / workflow activation | Owner gates | OFF (source-default) | Separate authorization per `RELEASE_GATES.md` Gate C |

## Commands (read-only in 8A)

```bash
pnpm continuity:start
pnpm release:readiness
pnpm release:readiness --verify-ordering
node scripts/validate-generated.mjs
```
