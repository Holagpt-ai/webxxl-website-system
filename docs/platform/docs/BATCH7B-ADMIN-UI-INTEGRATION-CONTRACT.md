# Batch 7B — Admin & Unified Experience UI integration (v0.app)

**Owner:** v0.app · **Cursor:** API contract and route only — no edits to v0-owned visual paths.

## Staff admin unified operations

| Surface | Path | Fetch |
|---|---|---|
| Platform staff overview (extended) | `app/[locale]/admin/**` (v0-owned panels) | `GET /api/v1/admin/operations/summary` |
| Per-customer drill-down | `app/[locale]/admin/customers/[customerId]/**` | `GET /api/v1/admin/operations/summary?customerAccountId={id}` |

**UI rules**

- Render slices only when `status === 'AVAILABLE'`.
- Show `reasonCode` / `message` for `UNAVAILABLE`; never show `0` as fake activity when unavailable.
- Runtime gates and execution summaries are **readiness**, not proof of live send, charge, migration, or AI execution.
- Keep English and Spanish dictionary keys; reuse existing `dict.admin` patterns.

## Customer dashboard (existing + optional)

| Surface | Fetch | Notes |
|---|---|---|
| AI Employees execution | `GET /api/v1/ai-workforce/execution/summary` | Batch 6 contract; slices only when `AVAILABLE` |
| Business Command Center | `GET /api/v1/customer-operations/summary` | Batch 1 — unchanged |
| Communications / Commerce / Marketing execution | Respective `GET .../execution/summary` | Batches 3–5 |

## Public conversion (Batch 7C — v0)

Delivered on `v0/public-conversion-7c` @ `5b3ff52` (11 files): pricing transparency/setup fees, quote CTA, plan continuity on Get Started, project shortcuts preserving query params, contact/wizard error recovery with `keptValues`, EN/ES in root dictionaries. Online checkout remains unimplemented (`checkoutNote`). Cursor integration: `__tests__/portal/batch7c-public-conversion-integration.test.ts`.

## Responsive presentation (Batch 7C — v0)

Layout wrapping pass on readiness kit, admin operations summary, AI readiness, marketplace panels, and business module cards. No backend or flag changes.

## Verification evidence (v0 handoff)

**v0 branch:** `v0/admin-ai-employees-ui-7b` @ `347907079f77167be0dcd29088a1009674ad3057` (2 commits ahead of `main` @ `8585d93`).

**Edited paths (12):** `app/[locale]/admin/page.tsx`, `app/[locale]/admin/customers/[customerId]/page.tsx`, `app/[locale]/dashboard/ai-employees/page.tsx`, `components/admin/operations-summary.tsx`, `components/ai-employees/execution-readiness.tsx`, `components/dashboard/readiness-kit.tsx`, `lib/admin-ui/operations.ts`, `lib/ai-employees-ui/execution.ts`, `lib/i18n/dictionaries/admin-operations-{en,es}.ts`, `lib/i18n/dictionaries/ai-workforce-execution-{en,es}.ts`.

**Locale:** dedicated EN/ES dictionary modules; pages select copy by `resolveLocale` / `getPageContext`.

**Cursor integration tests:** `__tests__/portal/batch7b-admin-ui-integration.test.ts` (API wiring, tenant site filter, slice gating, no false live-execution copy).

Reconciled in `ROUTE_MAP` and `DATA_AND_SERVICES` on Batch 7B integration PR.
