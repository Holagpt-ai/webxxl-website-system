# Deployment and Activation Register

**Reviewed:** 2026-10-25. Update a row only when the evidence changes.

| Surface | Source | Deployed SHA | Migrations | Flags / providers | Verification |
|---|---|---|---|---|---|
| WebXXL app | `main` `c0a21db93d730c838fc58d9b862ed547927bd72f` | DEPLOYED. GitHub deployment `7233002736`, `vercel[bot]`, environment Production, state success, 2026-10-21T17:41:12Z. Target URL on that status: `https://webxxl-website-system-iy1c0lju7-tone4real-7828s-projects.vercel.app` | UNVERIFIED | UNVERIFIED | SHA deploy only. `www.webbxxl.com` was not re-probed for SHA equality in this review |
| Analytics backend and dashboard | PRs #48 and #49 are inside that SHA | Same production deployment | `20261021120000_analytics14_foundation` apply UNVERIFIED | Source defaults off | No authenticated analytics smoke test in this review |
| AUTO-10 worker | PR #42 on `main` | Included only as code in the app SHA | UNVERIFIED | Source contract default off | No live execution inferred |
| External providers | Adapters exist in source | Not a separate deployment record | n/a | Do not infer a connection from adapter code | Per-provider check still required |

Machine-readable copy of the production SHA record: [`deployment-evidence/2026-10-21-production-sha.json`](deployment-evidence/2026-10-21-production-sha.json).

## Record format

`environment | service | released_at_utc | git_sha | deployment_id | deployment_url | migration_ids_applied | flags | provider_scope | result | evidence_url`

`scripts/check-deployment-evidence.mjs` validates that JSON. It does not call Vercel, does not commit, and rejects `VERIFIED_LIVE` when migrations or flags are still `UNVERIFIED`. A missing file prints UNVERIFIED and exits 0. The manual workflow `.github/workflows/deployment-evidence.yml` uploads a report artifact. It does not push to `main`.
