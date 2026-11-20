# RELEASE-001 Step 5 — Post-migration verification (read-only)

**Recorded:** 2026-11-20  
**Production DB:** `txfxeehglqfszletuumn`  
**Migration source SHA:** `570b223f22b855f703c48d5da5504d92a5c5125f`  
**Evidence:** [`deployment-evidence/2026-11-20-production-step5-post-migration-verify.json`](deployment-evidence/2026-11-20-production-step5-post-migration-verify.json)

## Overall: **PASS_WITH_BLOCKERS**

| Area | Verdict |
|------|---------|
| GitHub `main` vs Production deploy SHA | **PASS** — both `570b223f22b855f703c48d5da5504d92a5c5125f` |
| Production Prisma ledger | **PASS** — **40/40**, **0** unresolved, `SupportRequestMessage` present |
| Vercel Production app reachability | **PASS** — `www.webbxxl.com` Ready; no deploy initiated |
| Vercel DB env binding (`DATABASE_URL`/`DIRECT_URL`) | **BLOCKED** — secrets present but values **not verifiable** via CLI/API |
| Unauthenticated API protection | **PASS** — sample admin/customer APIs **401** |
| Public marketing site | **PASS** |
| Authenticated EN/ES customer/admin matrix | **BLOCKED** — **AUTH-STAGING-8C / ISSUE-105-QA** (not in scope for unauthenticated probes) |
| Provider activation / flags / DNS / publishing | **Not tested** — separate gates |

## 1. GitHub vs Vercel Production

| Field | Value |
|-------|--------|
| `origin/main` (fetched 2026-11-20) | `570b223f22b855f703c48d5da5504d92a5c5125f` |
| Latest GitHub **Production** deployment | `570b223f22b855f703c48d5da5504d92a5c5125f` (`id` **7919995501**, success) |
| Vercel deployment | `dpl_CN76Ffr4bLc517tTEw6UuQXypd4c` — **Ready**, aliases include `www.webbxxl.com` |
| Mismatch | **None** observed between live `main` and latest Production deploy SHA |

Prior documented deployment `623a9e9` / `dpl_Adby8MqB9…` is **superseded** by the Nov 19 deploy at **`570b223f…`**.

## 2. Production database (read-only)

Verified via authorized local pooler probe only; **no writes**.

| Metric | Value |
|--------|--------|
| Identity | `supabase:txfxeehglqfszletuumn/postgres` |
| Finished | **40** |
| Unresolved | **0** |
| Rolled-back history | **1** (Batch 24 failed attempt row — expected) |

## 3. Production environment (non-secret only)

From `vercel env ls` (Production): `DATABASE_URL` and `DIRECT_URL` are **configured** (Secret, hidden). **Cannot** confirm they reference `txfx…` vs `vcgib…` without owner-decrypted values — treat runtime DB wiring as **UNVERIFIED** even though the database itself is at **40/40**.

Non-secret config visible: `AUTH_URL` / `NEXT_PUBLIC_SITE_URL` → `https://www.webbxxl…`, `LEADS_TO_EMAIL` → `hello@webbxxl.com`.

## 4. Bounded HTTP checks (no POST, no auth, no side effects)

| Target | Result |
|--------|--------|
| `https://www.webbxxl.com` | Marketing homepage content **reachable** |
| `GET /api/v1/admin/operations/summary` | **401** |
| `GET /api/v1/customer-operations/summary` | **401** |
| `GET /login` | **200** |
| `GET /dashboard` (unauthenticated) | **200** with login/session signals in HTML — **not** a substitute for authenticated CRM/portal acceptance |

## 5. Remaining release gates

1. **AUTH-STAGING-8C / ISSUE-105-QA** — authenticated customer + admin flows, desktop + mobile, **EN + ES**.
2. **POLICY-SUB-001** — commercial/policy owner gate.
3. **Vercel Production DB secrets** — confirm `DATABASE_URL`/`DIRECT_URL` fingerprint to `txfx…` (owner Dashboard or controlled decrypt).
4. **Provider activation / feature flags** — UNVERIFIED; no sends/charges/ingestion authorized.
5. **Optional:** post-migrate **authenticated** production smoke (login, portal nav, support/CRM read paths) — **not executed** in Step 5.

## 6. Repository sync (not committed)

Local uncommitted work includes RELEASE-001 Steps **3–5** docs/evidence and continuity edits (`PROJECT_MEMORY.md`, `SESSION_HANDOFF.md`, `DEPLOYMENT_STATUS.md`). **No commit** per assignment.

## Related

- Step 4C: [`RELEASE-001-STEP4C-PRODUCTION-REPAIR.md`](RELEASE-001-STEP4C-PRODUCTION-REPAIR.md)