# Batches 10A–14 — consolidated v0 customer UI integration

**Status:** IN PR · **Source branch:** `v0/batch-10-14-ui` @ `1f15968092e1d0b9be79466a0614b21c0b66a105` · **Baseline `main`:** `2c770628d5355463a88f9752a9948e9400e0e09f` (PR **#152** MERGED Batch 15).

## Scope (preserved from v0, not redesigned)

| Batch | UI delivery |
|---|---|
| **10A** | CRM company detail (`/dashboard/crm/companies/[companyId]`), custom fields, suppression lift UI, consent extensions |
| **10B** | Managed-site switcher, dashboard context guard (`useDashboardContextGuard`), layout wiring |
| **11** | Marketing artifact/deliverable destination links from server `destination.path` |
| **12** | Social campaign approval + scheduling read-only panels; marketing timeline handoff |
| **13** | SEO integration panels (keywords, competitors, crawl runs, Google readiness handoff) |
| **14** | Communications provider readiness, contact comms handoff, analytics acquisition/measurement/conversion drill-downs |

Locales: English (unprefixed) and Spanish (`/es/...`). No provider activation, live sends, or payments.

## Shared-file reconciliation (Cursor)

| File | v0 change | Engineering review |
|---|---|---|
| `app/[locale]/dashboard/layout.tsx` | Loads `managedSite` list + cookie selection; passes props to shell | **Retain** — uses existing `lib/portal/active-managed-site.ts`; tenant scoped by `portal.customerAccount.id` |
| `lib/platform/crm/page-entitlement.ts` | Adds `/dashboard/crm/companies/[companyId]` to gated paths | **Retain** — aligns Issue #105 page gate with new route |
| `lib/crm-ui/workspace.ts` | Maps HTTP **503** / `UNAVAILABLE` for OPEN-001 backend-unavailable UX | **Retain** — matches Batch 15 API contract |

## Verification (integration branch)

- `npx tsc --noEmit` — **PASS**
- `__tests__/platform/batch14-analytics.test.ts` + `batch14-comms-analytics-http.test.ts` — **16/16 PASS**
- `__tests__/platform/batch15-api-auth-alignment.test.ts` — **5/5 PASS**

## Known baseline failures (reproduce on `main`, not introduced by this UI PR)

- `__tests__/admin/batch6-customer-access.test.ts` — switch account case **11–13**
- `__tests__/platform/open001-social-route-auth.test.ts` — flag-order expectation stale vs Batch **#152** OPEN-001 ordering
- `__tests__/platform/batch40-final-migration-chain.test.ts` — folder count **41** vs fixture **39**

## Deferred

- **AUTH-STAGING-8C** / ISSUE-105-QA final acceptance
- Batch **10A** production migration apply
- Provider activation, DNS, live communications