# Batch 1 — Customer Operations Engine (pre-implementation delta)

**Status:** Batch 1 backend integration in owner-review PR (Issue **#111**). Roadmap closeout merged in PR #110 @ `fcceade`.  
**ADR:** not required for this delta record (no architecture change).

## Scope (Issue #109)

Connect **lead → CRM → deal/task/qualification → operations overview** and **customer project lifecycle** using existing merged modules. Preserve OPEN-001 / CRM entitlement gates and `CustomerAccount` isolation.

## Relevant merged modules (source on `main`)

| Area | Primary paths / contracts | Merge evidence |
|---|---|---|
| Native CRM APIs & workflows | `lib/platform/crm/`, `app/api/v1/crm/**`, Batches 17–25+ | `docs/PROJECT_MEMORY.md` evidence rows |
| CRM page entitlement | `lib/platform/crm/page-entitlement.ts`, CRM layout | [PR #106](https://github.com/Holagpt-ai/webxxl-website-system/pull/106) |
| Customer project / website portal | `app/[locale]/dashboard/**` (project, milestones, approvals — **v0-owned UI**) | Master TAD + Batch 16 |
| Managed-site lead intake | `lib/platform/site-leads/connector/**`, `config/site-lead-intake.ts`, migration `20261031120000_batch28a_managed_site_leads` | [BATCH28A-MANAGED-SITE-LEADS-API-CONTRACT.md](BATCH28A-MANAGED-SITE-LEADS-API-CONTRACT.md) |
| Lead qualification & conversion | `lib/platform/site-leads/summary-service.ts`, CRM contact conversion paths in Batch 28A contract | Merged APIs + focused tests |
| Lead funnel reporting | `GET /api/v1/site-leads/funnel-report`, `lib/platform/site-leads/funnel-report-service.ts` | PR #80 (Batch 30A) |
| Business Command Center | `GET /api/v1/business/overview`, `lib/platform/business-overview/service.ts`, `/dashboard/business` | PRs #72, #74, #80 |

## Delta matrix

| Item | Merged / complete in source | Missing or partial | UI (v0) | Runtime gates (separate) | Release QA |
|---|---|---|---|---|---|
| CRM core (contacts, deals, tasks, audiences) | Backend + customer UI slices merged (Batches 17–26) | End-to-end **orchestration** across lead→deal not one bounded “engine” module | v0 CRM surfaces; **CRM-SUBNAV-105 REPORTED** | CRM flags default OFF; production migrate **UNVERIFIED** | **Deferred** (Issue #109) |
| Managed-site lead intake | APIs, connector, tests (Batch 28–29) | Live public form activation / prod wiring **not** implied | v0 lead surfaces where merged | Intake flag default OFF | **Deferred** |
| Qualification → CRM contact | Conversion contract in Batch 28A | Cross-module **happy path** integration tests only at unit level; no release E2E | Partial in CRM/site UI | Staging data **UNVERIFIED** | **Deferred** |
| Funnel + Command Center | Reporting + overview attachment (30A, 27A) | Unified “operations engine” navigation and status rollup across modules | `/dashboard/business` + funnel UI (30C) | Read APIs only; no activation | **Deferred** |
| Customer project lifecycle | Project dashboard, milestones, approvals (existing portal) | Explicit linkage from **operations** view back to project milestones/ETAs | v0 project UI | Unchanged approval/DNS gates | **Deferred** |

## Proposed Batch 1 implementation focus (after roadmap PR merge)

1. **Bounded backend/integration** wiring: managed-site lead events → CRM qualification state → Business Command Center overview slices (no new parallel CRM architecture).
2. **Preserve** existing HTTP contracts; extend only where Batch 28A/30A/27A contracts allow.
3. **Focused tests** on tenant isolation, entitlement denial, idempotent conversion, and overview attachment — **not** full browser QA.
4. **v0 handoff** only for net-new UI polish (e.g. subnav defect, cross-link UX) on v0-owned paths; Cursor integrates after delivery.

## Dependencies before coding

- [ ] Owner merges Issue **#109** roadmap closeout PR (checkpoint @ `5d90c124` or successor).
- [ ] Exact v0 file list for any UI polish agreed before parallel work.
- [ ] No production migration, flag activation, or staging fixture reprovision without separate owner authorization.

## Explicitly out of scope for Batch 1

- Marketing, SEO, comms, commerce, AI workforce batches (2–7).
- Batch 8 release certification and Issue #105 broad browser QA.
- Rebuild or re-merge of historical Batches 1–43.
