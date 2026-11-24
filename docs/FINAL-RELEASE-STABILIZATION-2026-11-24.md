# Final release stabilization — consolidated readiness

**Evidence date:** 2026-11-24 · **Repository:** `Holagpt-ai/webxxl-website-system`  
**GitHub `main`:** `f52ed8f724d54ab0384d62da1030b212126e74ff` · **PR #153 MERGED** (consolidated v0 UI Batches 10A–14)

## 1. Verified production deployment

| Evidence | Value |
|---|---|
| Merge commit | `f52ed8f724d54ab0384d62da1030b212126e74ff` |
| GitHub Production deployment | **`8036279476`** @ `f52ed8f724d54ab0384d62da1030b212126e74ff` |
| Deployment status | **success** — "Deployment has completed", 2026-11-24T17:56:27Z |
| Trigger | Automatic from merge (no manual deploy) |
| Prior production SHA (independent record) | `ef5776e` deployment **`7952960484`** (Step 6A baseline) |

**Claim limits:** SHA deploy proof only. Production runtime DB still **40/40** per Step 6A. Batch **10A** migration **not** applied. Provider/flag activation **not** verified.

---

## 2. Database migration readiness

### Ledger (unchanged)

- Production `txfxeehglqfszletuumn`: **40/40** migrations applied — **VERIFIED** Step 6A (2026-11-21).
- Staging `vcgibefnhneaqhcguhnt`: **39/39** at acceptance checkpoint (2026-11-14 rotation evidence).

### Batch 10A — ready package, **not authorized to apply**

| Item | Detail |
|---|---|
| Migration folder | `prisma/migrations/20261123120000_batch10a_crm_company_suppression_lift` |
| SQL scope | `ContactSuppression` lift audit columns (`liftedAt`, `liftedByUserId`, `liftReason`, `liftIdempotencyKey`) + unique idempotency index |
| Source merge | PR **#146** @ `142395b` |
| UI dependency | Company detail + suppression lift UI on `main` via PR **#153** |
| Production state | **NOT APPLIED** — API/UI lift path **503/DB error** until owner-authorized `prisma migrate deploy` |
| Pre-migrate checklist | Owner authorization · maintenance window · rollback plan · post-migrate smoke on `suppression/lift` · **no** flag changes in same window unless approved |
| Post-migrate (separate gates) | `CRM_BACKEND_ENABLED` and subscriber evidence still required for live CRM API |

**Do not run production migrate without explicit owner authorization.**

---

## 3. Operational vs gated (source defaults / architecture)

### Operational on Production (evidence-backed)

| Surface | State | Evidence |
|---|---|---|
| Public marketing site | Deployed @ `f52ed8f` | Vercel Production success |
| Auth / session (customer + staff) | Source on `main` | Step 6A + historical ADMIN login **VERIFIED** (do not re-audit) |
| Staff ADMIN + operations DB diagnostic | **VERIFIED** | [`RELEASE-001-STEP6A-LIVE-VERIFICATION-RESULT.md`](RELEASE-001-STEP6A-LIVE-VERIFICATION-RESULT.md) |
| Customer portal shell, EN/ES routes, consolidated workspaces UI | **MERGED** source @ `f52ed8f` | PR **#153**; **NOT VERIFIED** in live owner session |

### Gated — default **OFF** in source (`config/*`, `features.ts`)

| Domain | Representative gates |
|---|---|
| CRM APIs | `CRM_BACKEND_ENABLED`, import/export/AI flags |
| Marketing | `MKT_BACKEND_ENABLED`, execution/approval/automation flags |
| Social | `SOCIAL_MARKETING_ENABLED`, `POSTIZ_*`, live publishing |
| SEO / Google | `SEO_BACKEND_ENABLED`, `SEO_GSC_API_ENABLED`, `SEO_GOOGLE_OAUTH_ENABLED`, crawl/rank providers |
| Communications | `COMMS_BACKEND_ENABLED`, `COMMUNICATIONS_OUTBOUND_ENABLED`, SMS/email/WhatsApp send |
| Analytics | `ANALYTICS_BACKEND_ENABLED`, ingestion/provider fetch |
| Commerce / wallet | `COMMERCE_*`, `WALLET_*`, live provider, checkout |
| AI workforce / customer AI | `AI_WORKFORCE_*`, `CUSTOMER_AI_*`, outbound/autonomous flags |
| Workflows | `WORKFLOW_*`, external effects |

Production Vercel env may differ from defaults; **activation UNVERIFIED** without owner env audit. No provider activation authorized in this stabilization.

### OPEN-001 (behavior unchanged)

Included FREE software for **website subscribers** at account scope. Page entitlement + API gates enforce denial for non-qualifying accounts. **POLICY-SUB-001** (subscription grace semantics) remains open — see §6.

---

## 4. AUTH-STAGING-8C — consolidated final acceptance matrix

**Host:** `https://www.webbxxl.com` (Production). Use **owner-designated** customer accounts — **not** staging pilot fixture IDs.

**Reuse (do not repeat):** Step 6A DB diagnostic · ADMIN magic-link + `/admin` · migration chain recovery · staging-only rotation matrix.

| ID | Scope | EN | ES | Mobile | Pass criteria |
|---|---|:---:|:---:|:---:|---|
| **A1** | Customer login + dashboard shell | ✓ | ✓ | ✓ | Magic link; dashboard loads; locale persists |
| **A2** | Managed-site / account switcher (Batch 10B) | ✓ | ✓ | ✓ | Switcher visible when sites exist; no cross-account leak |
| **B1** | CRM OPEN-001 — subscriber | ✓ | ✓ | ✓ | `/dashboard/crm` eligible or honest locked state; company detail route |
| **B2** | CRM OPEN-001 — non-subscriber | ✓ | ✓ | — | Locked UI; API `FREE_SOFTWARE_NOT_ELIGIBLE` / 403 |
| **B3** | Tenant isolation | ✓ | — | — | No cross-`CustomerAccount` data via API paste or UI |
| **C1** | Marketing / SEO / Comms workspaces | ✓ | ✓ | spot | Navigation + drill-down panels load or show 503/unavailable honestly |
| **D1** | Analytics drill-downs (Batch 14 UI) | ✓ | ✓ | — | Acquisition/measurement/conversion tabs without false live claims |
| **E1** | Project approvals / owner-review | ✓ | ✓ | — | Read-only unless owner package enabled |
| **F1** | Staff admin operations summary | — | — | ✓ | **CREDITED** Step 6A; spot-check summary still disabled-honest only |
| **G1** | AI Employees disclosures | ✓ | ✓ | ✓ | Execution-off banners; no fake live state |
| **H1** | Responsive layout | ✓ | ✓ | ✓ | No critical break on dashboard + one admin sample |

Record outcomes in [`BATCH8B-STAGING-ACCEPTANCE-REPORT.md`](BATCH8B-STAGING-ACCEPTANCE-REPORT.md) or a dated Production addendum — **VERIFIED** rows only.

---

## 5. Historical test failures (not release blockers)

Pre-existing on `main`; **not** application regressions from PR **#153**:

| Test | Issue |
|---|---|
| `__tests__/admin/batch6-customer-access.test.ts` §11–13 | Switch-account mock expectation |
| `__tests__/platform/open001-social-route-auth.test.ts` | Flag-order expectation vs Batch **#152** OPEN-001 ordering |
| `__tests__/platform/batch40-final-migration-chain.test.ts` | Folder count 41 vs fixture 39 |

Optional bounded hygiene PR after acceptance; **not** required for stabilization sign-off.

---

## 6. Owner decisions (document only — no behavior change)

| ID | Topic | State |
|---|---|---|
| **POLICY-SUB-001** | Whether `PAST_DUE` / `CANCEL_SCHEDULED` subscriptions grant OPEN-001 included-free access | **REPORTED** — code currently qualifies; owner commercial decision pending ([`ISSUE_REGISTER.md`](ISSUE_REGISTER.md)) |
| **OPEN-014** | Primary domain `webbxxl.com` | **Resolved**; service subdomains open |
| Batch **10A** production migrate | Lift columns on Production DB | **Pending owner authorization** |
| Provider activation / live sends / payments / DNS | — | **Not authorized** |

---

## 7. Genuine blockers requiring owner action

1. **AUTH-STAGING-8C** — One consolidated Production inspection (matrix §4); customer EN/ES still **NOT VERIFIED**.
2. **Batch 10A migration** — Authorized production apply when owner is ready (readiness §2).
3. **POLICY-SUB-001** — Commercial/subscription grace decision before claiming OPEN-001 launch semantics.
4. **Production feature flags** — Env audit if owner intends CRM/MKT/COMMS live (defaults OFF in repo).
5. **Optional:** Post-`f52ed8f` production SHA cross-check on `www.webbxxl.com` response headers vs deployment record.

---

## 8. Next step toward launch

1. **Owner:** Execute matrix §4 once on Production @ `f52ed8f` (single inspection pass).
2. **Owner:** Authorize Batch **10A** migrate + post-migrate smoke if CRM suppression lift must be live.
3. **Owner:** Resolve **POLICY-SUB-001** or accept current fail-closed semantics explicitly.
4. **Owner:** Authorize flag/provider enablement per module — separate from UI merge.
5. **Cursor/Ops (only if authorized):** Migration apply, env flag updates, DNS cutover — each with its own gate.

**No further development batches** until acceptance outcomes and owner gates above are recorded.