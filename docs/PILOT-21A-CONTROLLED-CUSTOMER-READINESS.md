# Batch 21A — Controlled customer pilot readiness

**Status:** Tooling and documentation on owner-review PR. **Not** production activation.  
**Baseline `main`:** `16861d9c796dd5b808c4186bc4611e10f0a434a2` (PR #62).  
**Production deploy (SHA only):** `dpl_6yeBmge7TwyYmeTKZaSGFKABoms9` — READY.

## Command

```bash
pnpm pilot:readiness
```

Optional read-only migration probe (no writes):

```bash
PILOT_READINESS_DB_PROBE=1 DATABASE_URL="postgresql://..." pnpm pilot:readiness
```

Output distinguishes **APPLICATION_CODE**, **DATABASE_MIGRATION**, **BACKEND_FLAG**, **ENTITLEMENT_POLICY**, **PROVIDER_CONFIG**, **AUTHORIZED_ACCOUNT**, **AUTHENTICATED_TEST**, and **OPERATIONAL_CAPABILITY**. Build success does **not** imply operational readiness.

## Synthetic pilot accounts (tests only)

| Account ID | Label |
|---|---|
| `acct_abmed_aesthetics` | ABMED Aesthetics (synthetic) |
| `acct_abmed_physicians` | ABMED Physicians Group (synthetic) |

Use `acct_unrelated_demo` as a third unrelated tenant in isolation tests. These are **not** production pilot tenants until owner provisioning.

## Migration prerequisites (apply requires separate owner authorization)

| Module | Migration folders |
|---|---|
| CRM | `20261018190000_crm05_foundation`, `20261018200000_crm05a_integrity` |
| COMMS | `20261018210000_comms06_foundation`, `20261018220000_comms06a_integrity` |
| SEO | `20261018230000_seo07_foundation` |
| Marketing | `20261018240000_mkt08_foundation` |
| Analytics (optional pilot scope) | `20261021120000_analytics14_foundation`, `20261025120000_analytics15_ingestion`, `20261025180000_analytics151_rate_limit` |

Production migration apply state remains **UNVERIFIED** until read from the target database.

## OPEN-001 / entitlements

`core.crm`, `core.marketing-studio`, `core.local-seo`, and `core.communications` evaluate to **POLICY_UNRESOLVED** at source defaults. Enabling backend flags alone does not grant customer API access. Owner must resolve OPEN-001 with explicit evidence — no silent price or eligibility change.

## Provider isolation (must stay OFF for controlled pilot)

Chatwoot API/outbound, Twilio, Resend, Postiz live publish, Google live SEO ingestion/crawler, MKT AI generation, workflow workers, wallet settlement/debits, SMS send, analytics live ingestion.

Unavailable capabilities must surface honest **503** / disabled UI states.

## Authenticated test matrix

| Check | Automated (Vitest) | Owner / staging |
|---|---|---|
| Login + account scope | BLOCKED | Required |
| CRM search/detail | Partial (authz rules) | BLOCKED without session |
| Marketing deliverables read | Partial (flags/entitlement) | BLOCKED without session |
| Local SEO stored/disconnected | Partial | BLOCKED without session |
| Communications inbox/connections | Partial | BLOCKED without session |
| Messages vs Communications routes | PASS | EN/ES smoke recommended |
| Account switching isolation | PASS (synthetic) | BLOCKED without session |
| EN/ES routes | PASS (localizePath) | UI smoke recommended |

## Owner authorization checklist (before real activation)

1. Resolve OPEN-001 cohort decisions and record in canonical decision log.
2. Authorize migration apply on the **pilot environment** only (not production without separate gate).
3. Enable module backend flags in that environment with evidence.
4. Provision two real internal CustomerAccounts + memberships (not ABMED synthetic fixtures).
5. Run authenticated EN/ES dashboard smoke; record evidence in deployment/pilot register.
6. Keep all provider and outbound integrations disabled until separate commercial/compliance authorization.
7. No DNS cutover, billing charges, or customer communications without explicit owner approval.

## Focused tests

`__tests__/platform/pilot21a-readiness.test.ts` — report shape, entitlements, isolation, navigation, locales.
