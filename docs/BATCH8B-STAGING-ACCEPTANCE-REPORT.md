# Batch 8B — Staging acceptance report

**Session:** 2026-11-13 · **Operator:** Cursor (read-only / gated) · **GitHub `main`:** `30746e513a990b37a63ced4973e80f704a92308c` ([PR **#131**](https://github.com/Holagpt-ai/webxxl-website-system/pull/131) Batch 8A **MERGED**)

**Production deploy (SHA only):** GitHub deployment **`7773401135`**, Vercel **success** 2026-11-13T18:37:06Z @ `30746e513a990b37a63ced4973e80f704a92308c`. Not migration, activation, or provider state.

## Staging safety preflight

| Check | Result | Evidence |
|---|---|---|
| Staging Supabase ref | **PASS** (identity) | `WEBXXL_STAGING_DATABASE_IDENTITY=supabase:vcgibefnhneaqhcguhnt/postgres` in local `.env.staging.local` (not in repo) |
| Production collision | **PASS** | `DATABASE_URL` / `DIRECT_URL` resolve to `vcgibefnhneaqhcguhnt` only; no `txfxeehglqfszletuumn` |
| `WEBXXL_STAGING_BOUNDARIES_CONFIRMED` | **PASS** | Set to `1` in authorized local env file |
| Staging DB preflight CLI | **PASS** | `migration-rehearsal.ts --verify-db` → identity `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Migration history (read-only) | **PASS** | `PILOT_READINESS_DB_PROBE=1` + `release-readiness.ts` → full chain **39/39** applied (finished, not rolled back) |
| `prisma migrate deploy` | **NOT RUN** | Per batch exclusions |
| Staging-bound Auth / Preview URL | **BLOCKED** | `.env.staging.local` has DB vars only — **no** `AUTH_SECRET`, `AUTH_URL`, or pilot session material |
| Credential rotation attestation | **UNVERIFIED** | Owner must confirm staging DB password still approved if rotation was flagged |
| Pilot magic-link sessions (A/B) | **BLOCKED** | No authorized sign-in without owner-supplied Auth env + mailbox access |

## Acceptance matrix (live evidence)

Public checks used **Production Vercel** `https://webxxl-website-system.vercel.app` (read-only, no form submit). **Deployed SHA assumed** from GitHub/Vercel status @ `30746e5`; per-URL SHA header was not independently verified.

Authenticated / staging-DB–bound items **BLOCKED** — see [Owner authorization required](#owner-authorization-required).

| # | Area | Status | Environment | SHA | Date | Role | Test | Evidence | Corrective action |
|---|---|---|---|---|---|---|---|---|---|
| 1 | EN/ES customer login + dashboard | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Magic-link login + post-auth dashboard | Login shell only: `/dashboard` → `/login` (unauthenticated). No session. | Owner: staging or production Preview with `AUTH_*` + Pilot A/B inbox access; record EN + ES dashboard load |
| 2 | Pilot A — subscriber CRM included | **BLOCKED** | Staging DB OK; app session missing | `30746e5` | 2026-11-13 | — | CRM overview/contacts as subscriber | Historical Issue #105 evidence on old Preview `@299a0fe` — **not re-verified** on `30746e5` | Authorized Pilot A session on env bound to `vcgibefnhneaqhcguhnt` |
| 3 | Pilot B — locked CRM + API 403 | **BLOCKED** | Same | `30746e5` | 2026-11-13 | — | Locked UI + `GET /api/v1/crm/contacts` | Contract tests on `main`; **no live 2026-11-13 call** | Pilot B session + API capture |
| 4 | CustomerAccount isolation | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Negative cross-account read | Vitest boundaries only; **no authorized live negative test** | Owner-authorized dual-session negative API test on staging |
| 5 | CRM overview, contacts, nested routes | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Deep links `/dashboard/crm/**` | — | Pilot A authenticated smoke |
| 6 | CRM subnav click (CRM-SUBNAV-105) | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Click vs direct URL | Issue #105 **REPORTED**; not reproduced this session | v0.app if still reproduces after authenticated session |
| 7 | Staff admin operations summary | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Admin drill-down | — | Staff session on authorized env |
| 8 | AI Employees readiness disclosures | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Customer AI UI; execution off | — | Customer session; confirm banners |
| 9 | Pricing → Get Started + contact form | **PASS** (public EN) · **PARTIAL** (ES) | Production Vercel alias | `30746e5` (assumed) | 2026-11-13 | Anonymous | Read-only page load | `/pricing` shows checkout disclaimer; `/get-started?plan=launch` loads step 1; `/contact` shows fields (no submit). ES: `/es/pricing` **Precios** OK; `/es/precios` → **404** (canonical path is `/es/pricing` per `localize.ts`) | Optional: add redirect or sitemap note for `/es/precios` if marketing expects Spanish slug |
| 10 | Project preview / approval / review | **BLOCKED** | — | `30746e5` | 2026-11-13 | — | Existing fixture screens | — | Customer session with project fixtures |
| 11 | Mobile/desktop responsiveness (7B/7C) | **UNVERIFIED** | Production public pages | `30746e5` | 2026-11-13 | Anonymous | Narrow viewport on dashboard/admin/7C surfaces | Public pricing/contact OK at desktop width; **authenticated 7B/7C layouts not exercised** | Authenticated responsive capture after login |

## Migration & source gates (completed)

| Gate | Status | Evidence |
|---|---|---|
| `release:readiness --verify-ordering` | **PASS** | 39 folders; advisory `DUPLICATE_TIMESTAMP_PREFIX` `20261031120000_*` |
| Staging `_prisma_migrations` probe | **PASS** | Read-only query 2026-11-13; full + pilot slices complete |
| Production migration apply | **UNVERIFIED** | Not probed; excluded |

## Defect register (this session)

| ID | Classification | Finding | Owner / platform |
|---|---|---|---|
| AUTH-STAGING-8B | Environment blocker | No Auth.js env for staging-bound acceptance in repo-local staging env file | Owner: Vercel Preview env + `AUTH_URL` matching staging DB |
| CRM-SUBNAV-105 | UI (unverified) | Subnav click defect — **not reproduced** (no session) | v0.app if still fails when reproed |
| ES-PATH-PRECIOS | Not reproduced / doc | `/es/precios` 404; working path `/es/pricing` | Product/SEO decision; optional redirect |
| ISSUE-105-REMAINDER | Deferred | Items 1–8, 10–11 blocked on auth | Batch 8C after authorization |

No engineering code changes in this batch (documentation + evidence only).

## Blocker register (carry-forward)

| ID | Type | State |
|---|---|---|
| RELEASE-001 | Owner gate | Open — staging acceptance incomplete |
| Issue #105 | Deferred QA | Partial — public only; authenticated **BLOCKED** |
| POLICY-SUB-001 | Owner policy | Open |
| Production migration proof | Environment | UNVERIFIED |
| `hello@webbxxl.com` mailbox | Operations | UNVERIFIED (needed for magic-link) |
| Staging credential rotation | Operations | Owner attestation **UNVERIFIED** |
| Provider / AI / workflow activation | Owner gates | OFF (source-default) |

## Owner authorization required

To complete **VERIFIED** rows on matrix items 1–8 and 10–11:

1. **Confirm** staging DB credentials in `.env.staging.local` (or Vercel Preview) remain owner-approved post-rotation.
2. **Provide** Vercel Preview (or dedicated staging app) with:
   - `DATABASE_URL` / `DIRECT_URL` → `vcgibefnhneaqhcguhnt` only
   - `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL`, trust host as required
   - Module flags as needed for CRM read-only smoke (e.g. `CRM_BACKEND_ENABLED=1` on Preview only — owner decision)
3. **Pilot accounts:** magic-link access to Pilot A (subscriber) and Pilot B (non-subscriber) mailboxes; **no** new staging records without separate authorization.
4. **Staff** credentials for admin operations summary (read-only).
5. **Optional:** screenshot artifact store path (e.g. `docs/deployment-evidence/2026-11-13-batch8b/`).

## Batch 8C prerequisites

- Close **AUTH-STAGING-8B** with dated EN/ES authenticated evidence @ `main` or designated Preview SHA.
- Re-run matrix items 1–8, 10–11; record CRM-SUBNAV-105 as PASS, FAIL, or v0 ticket.
- Issue **#105** closure or scoped deferral with owner sign-off.
- **RELEASE-001** certification inputs: production migration evidence (separate authorization), flag activation gates, `hello@webbxxl.com` verification.
- No production migrate, activation, or live sends without explicit owner authorization.
