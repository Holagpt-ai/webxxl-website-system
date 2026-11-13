# Batch 8B — Staging acceptance matrix

**Status:** Partial execution 2026-11-13 — see [`BATCH8B-STAGING-ACCEPTANCE-REPORT.md`](BATCH8B-STAGING-ACCEPTANCE-REPORT.md). **Prerequisite:** Batch 8A merged @ `30746e5`.

**Prohibited without owner authorization:** production migrate, live cross-tenant DB reads, outbound sends, payments, provider activation, AI execution, workflow cron.

## Matrix

| Area | EN | ES | Evidence required | Pass criteria |
|---|---|---|---|---|
| Auth + customer shell | ✓ | ✓ | Dated screenshot or session log on staging/preview | Login, locale toggle, dashboard loads |
| OPEN-001 Pilot A/B | ✓ | ✓ | Two synthetic accounts + subscription proof seeded | INCLUDED vs locked states honest |
| CRM workspace (page entitlement) | ✓ | ✓ | `/dashboard/crm/**` spot check | No regression vs PR #106; gates not bypassed |
| Tenant isolation | — | — | Negative cross-account API attempt (authorized test) | 403/404; no data leak |
| Admin nav + operations summary | ✓ | ✓ | Staff session | Batch 7 summary slices; no fake live state |
| Public conversion | ✓ | ✓ | `/pricing` → `/get-started?plan=` | Plan continuity; `checkoutNote`; no checkout success UI |
| AI Employees readiness | ✓ | ✓ | Customer session | Execution summary disclosure; live-off banners |
| Approvals / review flows | ✓ | ✓ | Existing project fixtures | Read-only unless owner enables writes |
| Dashboard responsiveness | ✓ | ✓ | Narrow viewport capture | No critical layout breakage (Batch 7C surfaces) |

## Fixtures to reuse

- Synthetic ABMED accounts (`lib/platform/fixtures/abmed`)
- `pnpm pilot:staging-fixture-plan` / Batch 41–43 planners (dry-run default)
- Prior pilot21a / Batch 31 reports where still valid (re-record date if reused)

## Owner sign-off fields

Record **VERIFIED** only with: environment, SHA, date, actor, and artifact link. Distinguish **merged**, **deployed**, **migrated**, **activated**, **verified**.
