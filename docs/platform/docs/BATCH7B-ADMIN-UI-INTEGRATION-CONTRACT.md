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

## Public conversion (deferred)

Pricing, lead capture, and marketing conversion surfaces on public/managed sites remain **deferred** to v0 in Batch 7. Do not fabricate connected analytics or CRM states on marketing pages.

## Mobile presentation (deferred)

Responsive layout pass for admin and customer dashboards is **deferred** (`unifiedExperience.mobilePresentation: DEFERRED_V0`). No Cursor changes to global layout components owned by v0.

## Verification evidence (v0 handoff)

List edited component paths, locale coverage (`en`/`es`), and screenshots or preview URLs. Cursor reconciles into `ROUTE_MAP` and `DATA_AND_SERVICES` on integration PR only.
