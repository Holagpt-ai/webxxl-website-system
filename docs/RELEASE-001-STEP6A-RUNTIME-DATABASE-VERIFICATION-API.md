# RELEASE-001 Step 6A — Runtime database verification API (implementation)

**Status:** PR #145 — **not deployed** to Production until merge + owner-authorized deploy.

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

Configuration identity **alone never** yields `VERIFIED_PRODUCTION`. Probes are bounded (**12s** timeout per check) so unreachable direct hosts cannot hang the request.

## Release PASS criteria (Production)

All of the following must be true in a single staff-authenticated response:

| # | Criterion |
|---|-----------|
| 1 | `DATABASE_URL` and `DIRECT_URL` parse to **`supabase:txfxeehglqfszletuumn/postgres`** (live env, not a label) |
| 2 | `configuration.urlsAligned === true` |
| 3 | `connectivity.databaseUrl === "OK"` |
| 4 | `connectivity.directUrl === "OK"` |
| 5 | `connectivity.migrationLedgerFinished === 40` |
| 6 | `verdict === "VERIFIED_PRODUCTION"` |

If (1)–(2) hold but (3)–(5) fail → `verdict` is **`UNVERIFIED`** (connectivity fields show `FAIL` / non-40 count).  
`MISMATCH` = different targets between the two URLs.  
`VERIFIED_STAGING` = both URLs identify staging **and** connectivity probes pass (no production release).

Read-only SQL: `SELECT 1` + finished migration ledger count only (no customer tables).

## Controlled deployment and verification (owner)

1. Merge PR #145 after review — **separate** from documentation PR #144.
2. Authorize **one** Vercel Production deployment of the merge commit.
3. Staff session on `https://www.webbxxl.com`.
4. `GET /api/v1/admin/operations/database-verification` (session cookie only).
5. Confirm **Release PASS criteria** table above.
6. If not PASS → **stop**; fix Vercel `DATABASE_URL`/`DIRECT_URL` or DB/migration state (owner); redeploy; re-check.
7. Record verdict + timestamp; then **AUTH-STAGING-8C** may proceed.

## Operator-only alternative

Staff browser session only after deploy — **no** public diagnostic.

## ADR

Not required — staff-gated read-only operational diagnostic.