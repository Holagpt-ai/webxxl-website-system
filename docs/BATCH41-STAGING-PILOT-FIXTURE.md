# Batch 41 — Staging pilot tenant fixture (dry-run only)

**Status:** IN PR · **Baseline `main`:** `22fa338196925f8b0e314f231a58aa179bb08257` (PR #101)  
**ADR:** not required (extends PILOT-21B / OPEN-001 tenancy; no policy change)

## Scope

Deterministic, idempotent **planning** for the two staging pilot accounts named in [`PILOT-21B-STAGING-EXECUTION-PLAN.md`](PILOT-21B-STAGING-EXECUTION-PLAN.md):

| Role | Account ID | Evidence |
|---|---|---|
| Subscriber A | `acct_pilot_staging_a` | ACTIVE `website.subscription` on the same `CustomerAccount` |
| Non-subscriber B | `acct_pilot_staging_b` | `CustomerMembership` only |

**Not in scope:** database apply, migrations, flags, providers, UI, live sends, or production access.

## Implementation

| Surface | Purpose |
|---|---|
| `lib/platform/pilot/staging-pilot-fixture-*.ts` | Stable IDs, environment guard, dry-run plan builder |
| `scripts/staging-pilot-fixture-plan.ts` | CLI entry (`pnpm pilot:staging-fixture-plan`) |
| `__tests__/platform/batch41-staging-pilot-fixture.test.ts` | Fixture correctness, isolation, refusal, idempotency |

## Usage

```bash
pnpm pilot:staging-fixture-plan
pnpm pilot:staging-fixture-plan --json
```

`--apply` and `WEBXXL_STAGING_PILOT_FIXTURE_APPLY=1` are **refused** in Batch 41. Owner authorization is required for any future staging apply gate.

## Guards

- Recorded production Supabase ref `txfxeehglqfszletuumn` is refused when `DATABASE_URL` or production identity env targets it.
- When `DATABASE_URL` is set, staging preflight must match `WEBXXL_STAGING_DATABASE_IDENTITY` for `vcgibefnhneaqhcguhnt`.
- ABMED Vitest fixture account IDs (`acct_abmed_*`) are not used for this staging pilot plan.

## Acceptance

1. Dry-run output names both accounts, subscription evidence on A only, separate memberships, and no ABMED reuse.
2. OPEN-001 preview: A **QUALIFIED**, B **NOT_ELIGIBLE** / `FREE_SOFTWARE_NOT_ELIGIBLE` under `SUBSCRIBER_ONLY`.
3. Billing-group sibling subscription rows do not qualify account B.
4. Re-running the planner yields the same `idempotencyKey` and `writesEnabled: false`.
5. Apply mode and production database targets are refused.
