# RELEASE-001 Step 6A — Runtime database verification API (implementation)

**Status:** Implemented on branch `feat/release-001-runtime-db-verification` — **not deployed** to Production in Step 6A.

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/admin/operations/database-verification` | `requireStaff()` |

## Response (minimal — no secrets)

```json
{
  "verdict": "VERIFIED_PRODUCTION",
  "configuration": { "urlsConfigured": true, "urlsAligned": true },
  "connectivity": {
    "databaseUrl": "OK",
    "directUrl": "OK",
    "migrationLedgerFinished": 40
  }
}
```

`verdict` is one of: `VERIFIED_PRODUCTION` | `VERIFIED_STAGING` | `MISMATCH` | `UNVERIFIED`.

Derived from **live** `process.env.DATABASE_URL` and `process.env.DIRECT_URL` via `authorizedDatabaseIdentityFromUrl()` — not from a manual identity label.

Read-only connectivity: `SELECT 1` on the default Prisma client (`DATABASE_URL`) and a short-lived client for `DIRECT_URL`; migration ledger **finished count only** (no customer tables).

## Controlled deployment and verification (owner)

1. Merge PR (after review) — **separate** from documentation PR #144.
2. Authorize **one** Vercel Production deployment of the merge commit (no env changes required if URLs already correct).
3. Sign in to `https://www.webbxxl.com` as a **staff** user (existing Auth.js session).
4. `GET https://www.webbxxl.com/api/v1/admin/operations/database-verification` with session cookie (browser devtools or authenticated curl).
5. Require `verdict === "VERIFIED_PRODUCTION"`, `configuration.urlsAligned === true`, `connectivity.databaseUrl` and `directUrl` === `"OK"`.
6. If `MISMATCH` or `VERIFIED_STAGING` — **stop**; fix Vercel Production `DATABASE_URL`/`DIRECT_URL` (owner), redeploy, re-check.
7. Record verdict + timestamp in owner evidence; then proceed to **AUTH-STAGING-8C**.

## Operator-only alternative (pre-deploy)

If staff session is unavailable locally: after deploy, owner may invoke the same `GET` from an authenticated staff browser session only — **no public diagnostic**.

## ADR

Not required — staff-gated read-only operational diagnostic; no schema or policy change.