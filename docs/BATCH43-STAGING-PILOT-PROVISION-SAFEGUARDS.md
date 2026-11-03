# Batch 43 — Staging pilot provision safeguards

**Status:** IN PR  
**Baseline `main`:** `bb7165fb7709dd3ef612842af9bf5b53375cc473` (PR #103 squash merge)  
**ADR:** not required (extends Batch 42 apply path; no policy change)

## Objective

Complete mandatory pre-apply gates **PILOT-42-PRE-001..003** from [`BATCH42-STAGING-PILOT-EXECUTION-FOUNDATION.md`](BATCH42-STAGING-PILOT-EXECUTION-FOUNDATION.md).

| Gate | Delivery |
|---|---|
| **PILOT-42-PRE-001** | `lib/platform/pilot/staging-pilot-fixture-collision.ts` + inspect `collisionConflicts` |
| **PILOT-42-PRE-002** | `__tests__/platform/batch43-staging-pilot-provision-safeguards.test.ts` (mocked execute path) |
| **PILOT-42-PRE-003** | Extended guard tests in same file |

Focused vitest (Batch 41–43 pilot tests): **29/29 pass** locally on this branch before PR open. Live staging `--apply` remains a separate owner gate.

**Not in scope:** live staging apply, production access, migrations, flags, UI, providers.

## Remaining for first authenticated EN/ES staging smoke

1. Vercel Preview bound to staging `vcgibefnhneaqhcguhnt` with `AUTH_URL` / Auth.js.
2. Owner-authorized `pnpm pilot:staging-fixture-provision --apply --confirm-staging-provision`.
3. `CRM_BACKEND_ENABLED=1` on preview only.
4. Owner-recorded EN/ES CRM navigation smoke (A subscriber, B blocked).
