# RELEASE-001 Step 6 — Runtime database identity gate

**Recorded:** 2026-11-20  
**Vercel project:** `webxxl-website-system`  
**Live:** `https://www.webbxxl.com`  
**Evidence:** [`deployment-evidence/2026-11-20-production-step6-runtime-db-identity.json`](deployment-evidence/2026-11-20-production-step6-runtime-db-identity.json)

## Runtime database identity: **VERIFIED** (Step 6A live, 2026-11-21)

**Supersedes** the 2026-11-20 **UNVERIFIED** state below for release gating.

Staff-authenticated Production `GET /api/v1/admin/operations/database-verification` returned **`VERIFIED_PRODUCTION`** with connectivity **OK**, ledger **40**, and aligned URLs. See [`RELEASE-001-STEP6A-LIVE-VERIFICATION-RESULT.md`](RELEASE-001-STEP6A-LIVE-VERIFICATION-RESULT.md) and [`deployment-evidence/2026-11-21-production-step6a-runtime-db-verification.json`](deployment-evidence/2026-11-21-production-step6a-runtime-db-verification.json).

### Historical (2026-11-20) — UNVERIFIED

The deployed application’s Prisma datasource target (`DATABASE_URL` / `DIRECT_URL`) **could not be proven** to be `txfxeehglqfszletuumn` from available non-secret, read-only evidence alone before Step 6A shipped and was exercised live.

---

## What was checked (no secret extraction)

| Source | Finding |
|--------|---------|
| Vercel Production `vercel env ls` | `DATABASE_URL`, `DIRECT_URL`, `STORAGE_SUPABASE_*` — **Secret**, values not listable/decryptable via CLI (per prior failed pulls; **not retried**) |
| `WEBXXL_PRODUCTION_DATABASE_IDENTITY` on Vercel | **Not configured** (not in Production env list) |
| Non-secret Vercel config | `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` → `https://www.webbxxl…` — proves site URL only, **not** DB ref |
| Public `www.webbxxl.com` HTML | **No** `txfx…`, `vcgib…`, or `supabase.co` strings |
| Repository runtime routes | **No** public/staff health route exposing `authorizedDatabaseIdentityFromUrl()` today |
| Direct Supabase production probe (Step 4C/5) | `txfx…` **40/40** — proves **database** state, **not** Vercel runtime wiring |

---

## Blocker

**Exact blocker:** Production `DATABASE_URL` / `DIRECT_URL` are Vercel **sensitive** secrets with no existing deployed, auth-safe diagnostic that returns a redacted Supabase project ref. Step 6 restrictions forbid credential changes, deployment, and repeating secret extraction.

---

## Smallest safe corrective procedures (separate owner authorization each)

Choose **one** path; do **not** run authenticated acceptance until identity is **VERIFIED PRODUCTION**.

### Option A — Owner dashboard proof (no deploy, no code) — **recommended first**

1. Vercel → **webxxl-website-system** → Settings → Environment Variables → **Production** → reveal `DATABASE_URL` (owner eyes only).
2. Confirm username contains **`postgres.txfxeehglqfszletuumn`** or host **`db.txfxeehglqfszletuumn.supabase.co`** — and **no** `vcgibefnhneaqhcguhnt`.
3. Repeat for `DIRECT_URL` (must match same project ref per repo preflight rules).
4. Record outcome (identity string only, no passwords) in a new evidence JSON or owner sign-off — **not** in Git.

### Option B — Non-secret guard env + redeploy (config only)

1. Add Vercel Production **plain** variable:  
   `WEBXXL_PRODUCTION_DATABASE_IDENTITY=supabase:txfxeehglqfszletuumn/postgres`  
   (matches [`lib/platform/pilot/staging-database-preflight.ts`](../lib/platform/pilot/staging-database-preflight.ts) pattern used on staging.)
2. Ensure `DATABASE_URL` / `DIRECT_URL` already point to `txfx…` (Option A).
3. **Redeploy** Production (separate deploy authorization) so runtime can compare URL fingerprint to guard.
4. Optional follow-up batch: startup log or staff-only read that asserts match (redacted) — **only if** automated proof is required.

### Option C — Minimal staff-only diagnostic API (code + deploy)

Bounded Cursor batch (ADR not required if read-only + redacted):

- `GET /api/v1/admin/operations/database-identity` — `requireStaff()`, returns  
  `{ "databaseIdentity": "supabase:txfxeehglqfszletuumn/postgres" }`  
  from `authorizedDatabaseIdentityFromUrl(process.env.DATABASE_URL)` — **never** full URL.
- Deploy to Production; owner performs **one** authenticated staff request on `www.webbxxl.com`.

**Do not** add a public endpoint.

---

## Documentation-only draft PR (Step 6)

Prepared branch **`docs/release-001-production-migration-evidence`** with RELEASE-001 Steps 3–6 docs, deployment-evidence JSON, and continuity updates only. **No merge** without owner review.

Excluded from PR: credentials, GPG/passphrase paths, local env, scratch `.pr-body-*`, unrelated staging scripts, backlog notes.

---

## Remaining release gates

1. **Runtime DB identity (Step 6A)** — **VERIFIED** (2026-11-21)
2. **AUTH-STAGING-8C / ISSUE-105-QA** — **authorized to proceed** (customer + admin login baseline verified; full matrix outstanding)
3. **POLICY-SUB-001**
4. Provider activation / flags / DNS / publishing — separate authorization

## Related

- Step 5: [`RELEASE-001-STEP5-POST-MIGRATION-VERIFICATION.md`](RELEASE-001-STEP5-POST-MIGRATION-VERIFICATION.md)