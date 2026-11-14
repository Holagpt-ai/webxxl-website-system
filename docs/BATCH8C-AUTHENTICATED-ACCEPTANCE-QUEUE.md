# Batch 8C — Authenticated acceptance queue (Batch 8B matrix remainder)

**Baseline `main`:** `d82d32382d2eee10473cf5f9c5281a92799046ad` (PR **#133**).  
**Acceptance Preview:** branch `staging/acceptance` @ `94235dd`, deployment **`dpl_CUpAftyiuiPUVGarnDT9YaxGF6BL`**, host `https://webxxl-website-system-git-stagi-add2b3-tone4real-7828s-projects.vercel.app`.  
**Staging DB:** `vcgibefnhneaqhcguhnt` — rotation **verified** 2026-11-14 ([`BATCH8C-STAGING-ROTATION-RESULT.md`](BATCH8C-STAGING-ROTATION-RESULT.md)).

**Not authorized in this queue:** magic-link sends, staff role changes, production migrate, providers, cron, outbound mail.

## Reuse fixtures (no new seeding)

| Role | CustomerAccount | Staging user (DB) | Notes |
|---|---|---|---|
| Pilot A (subscriber) | `acct_pilot_staging_a` | `akacarlosacosta+webxxl-a@gmail.com` | Active `website.subscription` on A |
| Pilot B (non-subscriber) | `acct_pilot_staging_b` | `akacarlosacosta+webxxl-b@gmail.com` | No qualifying subscription |
| Staff | Existing `STAFF`/`ADMIN` users only | — | No account creation |

## Matrix items to execute (owner session required)

| # | Area | Procedure (EN + ES where marked) | Pass criteria |
|---|---|---|---|
| 1 | Customer login + dashboard | Magic-link login on acceptance host; toggle `/es/dashboard` | Dashboard shell loads; locale persists |
| 2 | Pilot A CRM included | `/dashboard/crm`, contacts overview | `INCLUDED` workspace; no locked panel |
| 3 | Pilot B denial | Same routes + `GET /api/v1/crm/contacts` | Locked UI; API **403** `FREE_SOFTWARE_NOT_ELIGIBLE` |
| 4 | Account isolation | Pilot A session only; negative API for B account id | **403/404**; no cross-tenant payload |
| 5 | CRM nested routes | Direct `/dashboard/crm/contacts`, `/leads/funnel` | Same entitlement as overview |
| 6 | CRM-SUBNAV-105 | Subnav click vs paste URL (Pilot A) | Navigation matches direct URL; else **v0** ticket |
| 7 | Staff admin summary | `/admin` + operations summary API | Staff-only; honest disabled/live-off states |
| 8 | AI Employees disclosures | `/dashboard/ai-employees` | Execution-off banners; no fake live state |
| 10 | Approvals / review | Project with owner-review package if present | Read-only unless owner enables writes |
| 11 | Responsiveness | Narrow viewport on dashboard + admin samples | No critical layout break (7B/7C surfaces) |

Item **9** (public pricing/contact) — **PASS** from Batch 8B; re-spot-check optional on Production only.

## Minimum owner authorization

1. **Vercel Deployment Protection** — grant tester access to acceptance Preview (SSO or bypass for assigned testers).
2. **Magic-link send** — explicit approval to trigger Auth.js email for Pilot A/B addresses on **Preview** (`RESEND` already on Preview; no production `AUTH_URL`).
3. **Mailbox access** — owner can complete magic link for `akacarlosacosta+webxxl-a/b@gmail.com`.
4. **Staff session** — one existing staff login on same Preview (no new roles).
5. **Optional CRM-SUBNAV-105** — if click still fails, authorize v0.app fix (visual only).

## Source evidence already **PASS** (do not re-audit)

- Batch **8D** Vitest (`batch8d-customer-portal-crm-hardening`, `crm-page-entitlement`).
- Issue **#105** page entitlement merged @ `e37f0a0`.
- Batches **1–7** + **8A** per `PROJECT_MEMORY.md`.

Record live matrix results in an update to [`BATCH8B-STAGING-ACCEPTANCE-REPORT.md`](BATCH8B-STAGING-ACCEPTANCE-REPORT.md) after execution — **VERIFIED** rows only with date + deployment id.