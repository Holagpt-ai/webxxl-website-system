# Batch 8C — Staging credential rotation result

**Date (UTC):** 2026-11-14 · **Gate:** `SEC-STAGING-CRED-2026-11-12` · **No secrets in this document.**

## Scope

| Surface | Project / ref | Touched |
|---|---|---|
| Supabase staging | `vcgibefnhneaqhcguhnt` | **Yes** — password rotated via Management API |
| Supabase production | `txfxeehglqfszletuumn` | **No** |
| Vercel Preview | Global `DATABASE_URL` + `DIRECT_URL` | **Yes** (Preview only) |
| Vercel Production | DB env | **No** |

## Verification (operator, 2026-11-14)

| Check | Result |
|---|---|
| New credential DB preflight | **PASS** — `supabase:vcgibefnhneaqhcguhnt/postgres` |
| Migration history (read-only) | **PASS** — **39/39** |
| Pre-rotation credential rejection | **PASS** — old URI fails preflight after rotation |
| Preview acceptance alias | **READY** — `dpl_CUpAftyiuiPUVGarnDT9YaxGF6BL` on `staging/acceptance` git host |
| Branch `AUTH_URL` | **Aligned** to stable `…-git-stagi-add2b3-…vercel.app` |
| `WEBXXL_STAGING_DATABASE_IDENTITY` (Preview) | **Unchanged** — `supabase:vcgibefnhneaqhcguhnt/postgres` |

## Tooling

- `scripts/staging-rotate-management-api.mjs` — Supabase `PATCH` (staging ref hardcoded); operator PAT in env only.
- `scripts/staging-sync-preview-database-env.mjs` — sync from gitignored `.env.staging.local` to Vercel **Preview**; refuses production ref in URLs; **Windows:** `npx.cmd` + shell for stdin pipe.

Production activation, provider flags, and production migrations are **out of scope** for this record.