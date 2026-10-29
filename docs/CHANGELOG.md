# Change Log

Merged and approved source events only. Plans stay in [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md). Deployment records stay in [`DEPLOYMENT_STATUS.md`](DEPLOYMENT_STATUS.md).

| Date (UTC) | Event | Evidence | Release claim |
|---|---|---|---|
| 2026-10-18 | Platform blueprint and FOUND-01 through AUTO-10 | PRs #32–#42 on `main` | Merge only. See the decision log for the original batch notes |
| 2026-10-21 | COMMERCE-11 and COMMERCE-12 | [PR #43](https://github.com/Holagpt-ai/webxxl-website-system/pull/43), [PR #44](https://github.com/Holagpt-ai/webxxl-website-system/pull/44), [PR #45](https://github.com/Holagpt-ai/webxxl-website-system/pull/45) | Merge only |
| 2026-10-21 | AI-CUSTOMER-13 | [PR #46](https://github.com/Holagpt-ai/webxxl-website-system/pull/46), [PR #47](https://github.com/Holagpt-ai/webxxl-website-system/pull/47) | Merge only |
| 2026-10-21 | ANALYTICS-14 backend and dashboard | [PR #48](https://github.com/Holagpt-ai/webxxl-website-system/pull/48), [PR #49](https://github.com/Holagpt-ai/webxxl-website-system/pull/49), `c0a21db93d730c838fc58d9b862ed547927bd72f` | Merged. Production deployment of that SHA recorded separately. No flag or migration claim |
| 2026-10-21 | Vercel production deployment of `c0a21db` | Deployment `7233002736`, state success | DEPLOYED SHA only |
| 2026-10-25 | Continuity and ADR controls | [PR #50](https://github.com/Holagpt-ai/webxxl-website-system/pull/50), `622b352592f2cdcb359034e1c6462cb62130b1d1` | MERGED. ADR-018..020 remain PROPOSED |
| 2026-10-25 | ANALYTICS-15 ingestion and conversion pipeline | [PR #51](https://github.com/Holagpt-ai/webxxl-website-system/pull/51), `f315e897218a48bfac44a0d50724c91d32b6c9c9` | MERGED. No activation or production-migration claim |
| 2026-10-26 | Operational records for PR #50 and PR #51, plus Batch 16 ownership direction | Continuity sync. Batch 16 has no implementation commit | Documentation only. Batch 16 is approved direction and is not implemented |
| 2026-10-26 | Continuity correction | [PR #52](https://github.com/Holagpt-ai/webxxl-website-system/pull/52), `2b7ec7be2aeadccfb595a2ab7edf59b775876efe` | MERGED. Documentation only. No flag or migration claim |
| 2026-10-27 | Vercel production deployment of `2b7ec7b` (PR #52 on `main`) | GitHub deployment `7347386169`, state success | DEPLOYED SHA only. Not migration or activation |
| 2026-10-28 | Batch 16A contract and continuity | [PR #53](https://github.com/Holagpt-ai/webxxl-website-system/pull/53), review queue | Documentation only. Superseded by 2026-10-29 merge row |
| 2026-10-29 | Batch 16A contract | [PR #53](https://github.com/Holagpt-ai/webxxl-website-system/pull/53), `69981c4c9576e8cc43ebe83aa2b486f27db5a6f3` | MERGED. Documentation and contract on `main`. No flag or migration claim |
| 2026-10-29 | Batch 16B customer workspace UI + Batch 16C integration | [PR #54](https://github.com/Holagpt-ai/webxxl-website-system/pull/54), `7fc7e264fb6044d6f3984f9fe69ada3787ddb3da` | MERGED. Customer dashboard UI. Not flag or migration claim |
| 2026-10-29 | Vercel production deployment of `7fc7e26` (PR #54) | Owner deployment `dpl_42XP6bJhgp8q9HnJntTQJ4w51McY`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 17A CRM core workflows | [PR #55](https://github.com/Holagpt-ai/webxxl-website-system/pull/55), `2ef9a90cd10222466faf0c6070995130456b7363` | MERGED. Backend APIs and tests. Not activated |
| 2026-10-29 | Batch 17A.1 CRM integrity corrections | Same PR #55 | Consent/evidence atomicity, task assignee validation, deal stage CAS, HTTP input validation |
| 2026-10-29 | Vercel production deployment of `2ef9a90` (PR #55) | Owner deployment `dpl_Gg2dKg34vncTJ1GMpVyC8mpYRFXv`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 17B CRM UI (v0) + Batch 17C integration | [PR #56](https://github.com/Holagpt-ai/webxxl-website-system/pull/56), `b6b8f5f88b65f27a606a5e2df0e9e35051ce05f4` | MERGED. CRM UI wired to 17A APIs. Not activated |
| 2026-10-29 | Vercel production deployment of `b6b8f5f` (PR #56) | Owner deployment `dpl_3BZVPBZzFH1AJ4KjpbTTReS9N285`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 18A Marketing deliverables & approvals backend | [PR #57](https://github.com/Holagpt-ai/webxxl-website-system/pull/57), `5e2759d9cca6b1461492cff59172c84693123f2c` | MERGED. List APIs + 18A.1 submit integrity. Not activated |
| 2026-10-29 | Vercel production deployment of `5e2759d` (PR #57) | Owner deployment `dpl_7CngvEWJTDWmYGGGYFWRZdLPXyyn`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 18B Marketing UI (v0) + Batch 18C integration | [PR #58](https://github.com/Holagpt-ai/webxxl-website-system/pull/58), `fa2a13a11e6200b542cfe978f96cd67b184dfb0c` | MERGED. Marketing Studio UI on `main`. Not activated |
| 2026-10-29 | Vercel production deployment of `fa2a13a` (PR #58) | Owner deployment `dpl_96p6EHuXyMrB1bWxR3uTFCyBMnYo`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 19A Local SEO stored intelligence | [PR #59](https://github.com/Holagpt-ai/webxxl-website-system/pull/59), `6ff105cf2334a9039d1d57d2dc0a3df878ad1730` | MERGED. Stored GSC read APIs + 19A.1 integrity. Not activated |
| 2026-10-29 | Vercel production deployment of `6ff105c` (PR #59) | Owner deployment `dpl_J5FdQqN19DQQDZdDuCb9x1YeNw3Z`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 19B Local SEO UI (v0) + Batch 19C integration | [PR #60](https://github.com/Holagpt-ai/webxxl-website-system/pull/60), `8b7cd4daf84ccd5f8ad3bd5af98fd8fb7b4b356e`, v0 `59315094` | MERGED. UI wired to 19A APIs. Not activated |
| 2026-10-29 | Vercel production deployment of `8b7cd4d` (PR #60) | Owner deployment `dpl_8rCQNVbuHAxxcC7kVmEGDh2oZyaT`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 20A Unified comms inbox foundation (+ 20A.1 integrity) | [PR #61](https://github.com/Holagpt-ai/webxxl-website-system/pull/61), `1389b328b07a17bd242179816448791477f3dd27` | MERGED. Read-only inbox APIs + BATCH20B contract. Not activated |
| 2026-10-29 | Vercel production deployment of `1389b32` (PR #61) | Owner deployment `dpl_GEbx95vE3hxF3M3vRkfmW3Y16pXH`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 20B Communications UI (v0) + Batch 20C integration | [PR #62](https://github.com/Holagpt-ai/webxxl-website-system/pull/62), `16861d9c796dd5b808c4186bc4611e10f0a434a2`, v0 `efa20676` | MERGED. UI + nav wired to 20A APIs. Not activated |
| 2026-10-29 | Vercel production deployment of `16861d9` (PR #62) | Owner deployment `dpl_6yeBmge7TwyYmeTKZaSGFKABoms9`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 21A + 21A.1 Controlled customer pilot readiness | [PR #63](https://github.com/Holagpt-ai/webxxl-website-system/pull/63), `603a601f42728cf758bd632507e0bdd2c8fdcc6b` | MERGED. Read-only pilot:readiness. Not activation |
| 2026-10-29 | Vercel production deployment of `603a601` (PR #63) | Owner deployment `dpl_Rf71rKnvwjngSRntTCjfFc7fHXGP`, READY | DEPLOYED SHA only |
| 2026-10-29 | Batch 21B OPEN-001 policy + staging preparation | Open PR, branch `feature/batch-21b-open001` | IN PR. SUBSCRIBER_ONLY enforcement. Not provisioning |

Earlier decision history: [`platform/docs/15-DECISIONS-CHANGELOG.md`](platform/docs/15-DECISIONS-CHANGELOG.md).
