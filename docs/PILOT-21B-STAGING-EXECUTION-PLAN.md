# Batch 21B — Isolated staging pilot execution plan (preparation only)

**Status:** Documentation and enforcement in owner-review PR. **No accounts, migrations, flags, or providers activated by this batch.**

**Baseline `main`:** `603a601f42728cf758bd632507e0bdd2c8fdcc6b` (PR #63 merged).

## OPEN-001 (recorded)

| Field | Value |
|---|---|
| Decision ID | OPEN-001 |
| Status | **RESOLVED — OWNER APPROVED** (2026-10-29) |
| Active cohort | `SUBSCRIBER_ONLY` |
| Inactive future options | `ALL_SIGNUPS`, `HYBRID` (env-switchable only with owner authorization) |
| Policy version | `2026-10-29.1` (`lib/platform/open001/policy.ts`) |

Website **subscribers** receive included FREE business software (CRM, Marketing Studio, Local SEO, Communications inbox software). Non-subscribers with portal login remain authenticated but receive **403 `FREE_SOFTWARE_NOT_ELIGIBLE`** when module backend flags are on. External provider charges remain separately governed.

## Two-account staging pilot (synthetic — not provisioned in this batch)

| Role | Suggested ID | Purpose |
|---|---|---|
| Pilot subscriber A | `acct_pilot_staging_a` (to be provisioned) | Active `website.subscription` on same CustomerAccount |
| Pilot non-subscriber B | `acct_pilot_staging_b` (to be provisioned) | Login + membership only — must not access module APIs |

Do **not** reuse or mutate ABMED production/synthetic fixture accounts (`acct_abmed_*`).

## Execution prerequisites (separate owner authorization)

1. **Database:** Full-chain `prisma migrate deploy` on isolated staging DB (read-only probe: `PILOT_READINESS_DB_PROBE=1 pnpm pilot:readiness`).
2. **Flags (staging only):** `CRM_BACKEND_ENABLED`, `MKT_BACKEND_ENABLED`, `SEO_BACKEND_ENABLED`, `COMMS_BACKEND_ENABLED` — one module at a time or together per owner plan; providers remain OFF.
3. **Subscription evidence:** For account A, create `CommerceSubscription` for product `website.subscription` with status `ACTIVE` scoped to `customerAccountId` (not BillingGroup alone). For legacy reconciliation, use `CustomerService.serviceKey = paid.website-subscription` with `ACTIVE` only when owner-approved.
4. **Memberships:** Two users with `CustomerMembership` on A and B respectively; verify account switching does not leak data.
5. **Authenticated session:** Manual EN/ES smoke on staging preview — CRM search, marketing read, SEO stored states, comms inbox/connections, Messages vs Communications routes.

## Automated coverage (CI)

- `__tests__/platform/open001-subscriber-eligibility.test.ts` — policy + account resolver matrix.
- `__tests__/platform/pilot21a-readiness.test.ts` — migration probe + OPEN-001 policy source checks.

## Evidence gaps (documented, not silently fixed)

- Legacy customers with only `hosting` or ambiguous `CustomerService.metadata.websiteSubscriptionLegacy` require owner reconciliation (`LEGACY_EVIDENCE_AMBIGUOUS`).
- Production subscription rows were **not** read or modified in Batch 21B.
