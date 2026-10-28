# Deployment and Activation Register

**Reviewed:** 2026-10-28. Update a row only when the evidence changes. Each production row is a separate SHA record. A later row does not replace the October 21 evidence.

| Surface | Source | Deployed SHA | Migrations | Flags / providers | Verification |
|---|---|---|---|---|---|
| WebXXL app, 2026-10-21 | `c0a21db93d730c838fc58d9b862ed547927bd72f` | DEPLOYED. GitHub deployment `7233002736`, `vercel[bot]`, environment Production, state success, 2026-10-21T17:41:12Z. Target URL on that status: `https://webxxl-website-system-iy1c0lju7-tone4real-7828s-projects.vercel.app` | UNVERIFIED | UNVERIFIED | Preserved SHA deploy only. `www.webbxxl.com` was not re-probed for SHA equality in this review |
| WebXXL app, 2026-10-25 PR #50 | `622b352592f2cdcb359034e1c6462cb62130b1d1` | DEPLOYED. GitHub deployment `7319600836`, `vercel[bot]`, environment Production, state success, 2026-10-25T21:42:28Z. Target URL on that status: `https://webxxl-website-system-803ak7g4j-tone4real-7828s-projects.vercel.app` | UNVERIFIED | UNVERIFIED | SHA deploy only. Not a migration or activation |
| WebXXL app, 2026-10-25 PR #51 | `f315e897218a48bfac44a0d50724c91d32b6c9c9` | DEPLOYED. GitHub deployment `7319975513`, `vercel[bot]`, environment Production, state success, 2026-10-25T22:16:18Z. Target URL on that status: `https://webxxl-website-system-8m0swbeto-tone4real-7828s-projects.vercel.app` | UNVERIFIED | UNVERIFIED | SHA deploy only. Not a migration or activation. `www.webbxxl.com` was not re-probed |
| WebXXL app, 2026-10-27 PR #52 | `2b7ec7be2aeadccfb595a2ab7edf59b775876efe` | DEPLOYED. GitHub deployment `7347386169`, `vercel[bot]`, environment Production, state success, 2026-10-27T00:50:15Z. Target URL on that status: `https://webxxl-website-system-oqauj2yp2-tone4real-7828s-projects.vercel.app`. Owner-reported Vercel deployment `dpl_4pCp9SaNQd31e2rvocFo9hKSyFtn` (READY) matches this SHA; the Vercel API was not authenticated in-repo | UNVERIFIED | UNVERIFIED | SHA deploy only. Not a migration, flag change, or provider activation. Custom-domain SHA equivalence and authenticated production behavior were not verified |
| Analytics backend and dashboard | PRs #48 and #49 are inside `c0a21db` | Included in deployment `7233002736` | `20261021120000_analytics14_foundation` apply UNVERIFIED | Source defaults off | No authenticated analytics smoke test in this review |
| Analytics ingestion | PR #51 is inside `f315e897218a48bfac44a0d50724c91d32b6c9c9` | Included in deployment `7319975513` as code | `20261025120000_analytics15_ingestion` and `20261025180000_analytics151_rate_limit` apply UNVERIFIED | Source defaults off | No authenticated analytics smoke test in this review |
| AUTO-10 worker | PR #42 on `main` | Included only as code in the app SHA | UNVERIFIED | Source contract default off | No live execution inferred |
| External providers | Adapters exist in source | Not a separate deployment record | n/a | Do not infer a connection from adapter code | Per-provider check still required |

Machine-readable copies: [`deployment-evidence/2026-10-21-production-sha.json`](deployment-evidence/2026-10-21-production-sha.json), [`deployment-evidence/2026-10-25-production-sha-pr50.json`](deployment-evidence/2026-10-25-production-sha-pr50.json), [`deployment-evidence/2026-10-25-production-sha-pr51.json`](deployment-evidence/2026-10-25-production-sha-pr51.json), and [`deployment-evidence/2026-10-27-production-sha-pr52.json`](deployment-evidence/2026-10-27-production-sha-pr52.json).

## Record format

`environment | service | released_at_utc | git_sha | deployment_id | deployment_url | migration_ids_applied | flags | provider_scope | result | evidence_url`

`scripts/check-deployment-evidence.mjs` validates that JSON. It does not call Vercel, does not commit, and rejects `VERIFIED_LIVE` when migrations or flags are still `UNVERIFIED`. A missing file prints UNVERIFIED and exits 0. The manual workflow `.github/workflows/deployment-evidence.yml` uploads a report artifact. It does not push to `main`.
