# WebXXL Project Memory

**Evidence review:** 2026-10-31 · **Repo:** `Holagpt-ai/webxxl-website-system` · **`main`:** `fc702c696fe0a35ef3b61f4dc3eb6dc896a06442` (PR #78)

This file is the operating index. The approved product contract remains [`docs/platform/docs/01-MASTER-TAD.md`](platform/docs/01-MASTER-TAD.md) and ADR-001 through ADR-017 in [`docs/platform/docs/15-DECISIONS-CHANGELOG.md`](platform/docs/15-DECISIONS-CHANGELOG.md).

## How to read status

| State | Meaning |
|---|---|
| PLANNED | Specified or queued. No merged batch. |
| IN PR | On a branch or open pull request. |
| MERGED | On GitHub `main`. |
| DEPLOYED | A deployment record names the SHA and environment. |
| MIGRATED | Migration history in that environment shows the migration applied. |
| ACTIVATED | The runtime flag or provider scope is on, with evidence. |
| VERIFIED | A dated test of the real behavior, not a green build. |
| DEFERRED | Kept in the architecture, not in the current batch. |
| BLOCKED | Waiting on an owner, vendor, or environment decision. |

Merged code is not an activated service. A production deployment of a SHA is not a migration and not a flag change.

## Decisions that stay in force

- `CustomerAccount` is the operational tenant. `BillingGroup` may group payment. It does not grant sibling CRM, messaging, or analytics access.
- WebXXL owns identity, audit, approvals, entitlements, wallet, and customer lifecycle. External products are adapters.
- English and Spanish stay in scope. The current customer portal, version-bound approval, and separate DNS cutover stay in place.
- Cursor owns non-visual engineering. v0.app owns UI/UX. Vercel hosts the WebXXL app. GitHub is the source.
- Approved free CRM, Marketing Studio, local SEO, and social capabilities are not silently repriced. Spend and provider use stay separately gated. **OPEN-001 resolved:** included FREE software for **website subscribers** (`SUBSCRIBER_ONLY`); account-level proof at API gates (`lib/platform/open001/`).
- Live billing, SMS, social publishing, Google ingestion, AI execution, and production migrations need their own authorization.

## Checkpoint

### Canonical checkpoint (six-field)

| # | Field | Value |
|---|---|---|
| 1 | Last verified checkpoint | **29A** **MERGED** (PR #78 @ `fc702c6…`); **29A.1** submission identity **IN PR** |
| 2 | GitHub SHA, branch, active PR | `fc702c696fe0a35ef3b61f4dc3eb6dc896a06442` on `main`; **PR #79** head `13268e8d950eac74ee3ec510d981278d3be45794` (open) |
| 3 | Production deployment | Vercel **`dpl_CUrcig1btP6LQy2CePa6DXmF87c9` READY** @ `fc702c6`. SHA only — not migration or activation |
| 4 | Last updated | 2026-10-31 |
| 5 | Next task / responsible platform | **Owner** merge **29A.1** PR (**Cursor**) |
| 6 | Open blocker / gate IDs | `SITE_LEAD_INTAKE_ENABLED` OFF; batch28a migrations UNVERIFIED/unapplied; live customer forms DEFERRED |

### Evidence table

| Item | State | Evidence |
|---|---|---|
| PR #48 analytics backend | MERGED | [PR #48](https://github.com/Holagpt-ai/webxxl-website-system/pull/48), `336b89b6ae59784c5cdd001e9b88ecfe1e874d78` |
| PR #49 analytics dashboard | MERGED | [PR #49](https://github.com/Holagpt-ai/webxxl-website-system/pull/49), head `402d762004cd4fa696b18d48b94bff0c5dc0b478`, squash `c0a21db93d730c838fc58d9b862ed547927bd72f` |
| Vercel production SHA (2026-10-21) | DEPLOYED | GitHub deployment `7233002736` by `vercel[bot]`, environment Production, state success, 2026-10-21T17:41:12Z, SHA `c0a21db93d730c838fc58d9b862ed547927bd72f`. Preserved record |
| Vercel production SHA (2026-10-25, PR #50) | DEPLOYED | GitHub deployment `7319600836` by `vercel[bot]`, environment Production, state success, 2026-10-25T21:42:28Z, SHA `622b352592f2cdcb359034e1c6462cb62130b1d1`. SHA only |
| Vercel production SHA (2026-10-25, PR #51) | DEPLOYED | GitHub deployment `7319975513` by `vercel[bot]`, environment Production, state success, 2026-10-25T22:16:18Z, SHA `f315e897218a48bfac44a0d50724c91d32b6c9c9`. SHA only. Not a migration or activation |
| Vercel production SHA (2026-10-27, PR #52) | DEPLOYED | GitHub deployment `7347386169` by `vercel[bot]`, environment Production, state success, 2026-10-27T00:50:15Z, SHA `2b7ec7be2aeadccfb595a2ab7edf59b775876efe`. SHA only. Not a migration or activation |
| Production migrations | UNVERIFIED | Not read from the production database |
| Analytics flags | Source default OFF; production values UNVERIFIED | `config/analytics-backend.ts`, `config/features.ts` `analyticsBackend: false` |
| PR #50 continuity / ADR | MERGED | `622b352592f2cdcb359034e1c6462cb62130b1d1` |
| Batch 15 ingestion pipeline (PR #51) | MERGED | [PR #51](https://github.com/Holagpt-ai/webxxl-website-system/pull/51), `f315e897218a48bfac44a0d50724c91d32b6c9c9`. Flags default off. Production migration UNVERIFIED |
| PR #52 continuity correction | MERGED | [PR #52](https://github.com/Holagpt-ai/webxxl-website-system/pull/52), `2b7ec7be2aeadccfb595a2ab7edf59b775876efe`. Documentation only |
| Batch 16A workspace contract | MERGED | [PR #53](https://github.com/Holagpt-ai/webxxl-website-system/pull/53), `69981c4c9576e8cc43ebe83aa2b486f27db5a6f3`. [`BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md) |
| Vercel production SHA (2026-10-29, PR #54) | DEPLOYED | Owner-reported Vercel deployment `dpl_42XP6bJhgp8q9HnJntTQJ4w51McY`, READY, SHA `7fc7e264fb6044d6f3984f9fe69ada3787ddb3da`. SHA only. Not migration or activation |
| Batch 16B+16C customer workspace | MERGED | [PR #54](https://github.com/Holagpt-ai/webxxl-website-system/pull/54), `7fc7e264fb6044d6f3984f9fe69ada3787ddb3da`. UI on `main`; CRM APIs remain flag-disabled at source defaults |
| Vercel production SHA (2026-10-29, PR #55) | DEPLOYED | Owner-reported Vercel deployment `dpl_Gg2dKg34vncTJ1GMpVyC8mpYRFXv`, READY, SHA `2ef9a90cd10222466faf0c6070995130456b7363`. SHA only. Not migration or activation |
| Batch 17A CRM core workflows | MERGED | [PR #55](https://github.com/Holagpt-ai/webxxl-website-system/pull/55), `2ef9a90cd10222466faf0c6070995130456b7363`. Search/pagination, deal stage, task update, consent HTTP |
| Vercel production SHA (2026-10-29, PR #56) | DEPLOYED | Owner-reported Vercel deployment `dpl_3BZVPBZzFH1AJ4KjpbTTReS9N285`, READY, SHA `b6b8f5f88b65f27a606a5e2df0e9e35051ce05f4`. SHA only. Not migration or activation |
| Batch 17B CRM UI (v0) + Batch 17C integration | MERGED | [PR #56](https://github.com/Holagpt-ai/webxxl-website-system/pull/56), `b6b8f5f88b65f27a606a5e2df0e9e35051ce05f4`. [`BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md) |
| Vercel production SHA (2026-10-29, PR #57) | DEPLOYED | Owner-reported Vercel deployment `dpl_7CngvEWJTDWmYGGGYFWRZdLPXyyn`, READY, SHA `5e2759d9cca6b1461492cff59172c84693123f2c`. SHA only. Not migration or activation |
| Batch 18A Marketing deliverables & approvals backend | MERGED | [PR #57](https://github.com/Holagpt-ai/webxxl-website-system/pull/57), `5e2759d9cca6b1461492cff59172c84693123f2c`. List APIs + submit-review atomicity |
| Batch 18B Marketing UI (v0) + Batch 18C integration | MERGED | [PR #58](https://github.com/Holagpt-ai/webxxl-website-system/pull/58), `fa2a13a11e6200b542cfe978f96cd67b184dfb0c`. [`BATCH18B-MARKETING-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH18B-MARKETING-UI-INTEGRATION-CONTRACT.md) |
| Vercel production SHA (2026-10-29, PR #58) | DEPLOYED | Owner-reported Vercel deployment `dpl_96p6EHuXyMrB1bWxR3uTFCyBMnYo`, state **READY**, SHA `fa2a13a11e6200b542cfe978f96cd67b184dfb0c`. SHA only. Not migration or activation |
| Vercel production SHA (2026-10-29, PR #59) | DEPLOYED | Owner-reported Vercel deployment `dpl_J5FdQqN19DQQDZdDuCb9x1YeNw3Z`, state **READY**, SHA `6ff105cf2334a9039d1d57d2dc0a3df878ad1730`. SHA only. Not migration or activation |
| Batch 19A Local SEO stored intelligence | MERGED | [PR #59](https://github.com/Holagpt-ai/webxxl-website-system/pull/59), `6ff105cf2334a9039d1d57d2dc0a3df878ad1730`. GSC stored read APIs + 19A.1 integrity |
| Vercel production SHA (2026-10-29, PR #60) | DEPLOYED | Owner-reported Vercel deployment `dpl_8rCQNVbuHAxxcC7kVmEGDh2oZyaT`, state **READY**, SHA `8b7cd4daf84ccd5f8ad3bd5af98fd8fb7b4b356e`. SHA only. Not migration or activation |
| Batch 19B+19C Local SEO UI (v0 + integration) | MERGED | [PR #60](https://github.com/Holagpt-ai/webxxl-website-system/pull/60), `8b7cd4daf84ccd5f8ad3bd5af98fd8fb7b4b356e`. v0 @ `59315094`. [`BATCH19B-LOCAL-SEO-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH19B-LOCAL-SEO-UI-INTEGRATION-CONTRACT.md) |
| Vercel production SHA (2026-10-29, PR #61) | DEPLOYED | Owner-reported Vercel deployment `dpl_GEbx95vE3hxF3M3vRkfmW3Y16pXH`, state **READY**, SHA `1389b328b07a17bd242179816448791477f3dd27`. SHA only. Not migration or activation |
| Batch 20A Unified comms inbox foundation | MERGED | [PR #61](https://github.com/Holagpt-ai/webxxl-website-system/pull/61), `1389b328b07a17bd242179816448791477f3dd27`. Read APIs + [`BATCH20B-COMMUNICATIONS-UI-CONTRACT.md`](platform/docs/BATCH20B-COMMUNICATIONS-UI-CONTRACT.md); no live Chatwoot/outbound |
| Batch 20B Communications UI (v0) | DELIVERED | `v0/communications-ui-20b` @ `efa206760ae076118a9c4c7c4fb7b6a716166f66` |
| Vercel production SHA (2026-10-29, PR #62) | DEPLOYED | Owner-reported Vercel deployment `dpl_6yeBmge7TwyYmeTKZaSGFKABoms9`, state **READY**, SHA `16861d9c796dd5b808c4186bc4611e10f0a434a2`. SHA only. Not migration or activation |
| Batch 20C Communications UI integration | MERGED | [PR #62](https://github.com/Holagpt-ai/webxxl-website-system/pull/62), `16861d9c796dd5b808c4186bc4611e10f0a434a2`. v0 @ `efa20676` |
| Vercel production SHA (2026-10-29, PR #63) | DEPLOYED | Owner-reported Vercel deployment `dpl_Rf71rKnvwjngSRntTCjfFc7fHXGP`, state **READY**, SHA `603a601f42728cf758bd632507e0bdd2c8fdcc6b`. SHA only. Not migration or activation |
| Batch 21A + 21A.1 Controlled customer pilot readiness | MERGED | [PR #63](https://github.com/Holagpt-ai/webxxl-website-system/pull/63), `603a601f42728cf758bd632507e0bdd2c8fdcc6b`. `pnpm pilot:readiness`; [`PILOT-21A-CONTROLLED-CUSTOMER-READINESS.md`](PILOT-21A-CONTROLLED-CUSTOMER-READINESS.md); no activation |
| Vercel production SHA (2026-10-29, PR #64) | DEPLOYED | Owner-reported Vercel deployment `dpl_EG54QzowAtcvrGibB3xWzpVxXYhE`, state **READY**, SHA `c6d12217e8457780f18bffb6ff61fa1bb117090f`. SHA only. Not migration or activation |
| Batch 21B OPEN-001 policy + staging prep | MERGED | [PR #64](https://github.com/Holagpt-ai/webxxl-website-system/pull/64), `c6d12217e8457780f18bffb6ff61fa1bb117090f`. `lib/platform/open001/`; [`PILOT-21B-STAGING-EXECUTION-PLAN.md`](PILOT-21B-STAGING-EXECUTION-PLAN.md); no provisioning |
| Vercel production SHA (2026-10-29, PR #65) | DEPLOYED | Owner-reported Vercel deployment `dpl_Es1UxLoXgEHThHwNm2phiQN1icsb`, state **READY**, SHA `2de0f7f3b7f8f80b7006d7f7b7b13c7866b3822b`. SHA only |
| WEBXXL-CONTINUITY-02 living blueprint sync | MERGED | [PR #65](https://github.com/Holagpt-ai/webxxl-website-system/pull/65), `2de0f7f3b7f8f80b7006d7f7b7b13c7866b3822b` |
| Batch 21C isolated staging preflight | COMPLETE (read-only) | [`PILOT-21C-STAGING-PREFLIGHT.md`](PILOT-21C-STAGING-PREFLIGHT.md); no staging DB identified; no duplicate infra provisioned |
| Batch 22A OPEN-001 authorization hardening | MERGED | [PR #66](https://github.com/Holagpt-ai/webxxl-website-system/pull/66), `c0ff8fed77f71adefbebc13fc44f9f9443c76a53`. Policy env lock + Social API subscriber gates |
| Batch 23 CRM data operations V1 | MERGED | [PR #67](https://github.com/Holagpt-ai/webxxl-website-system/pull/67), `99f644e1c310d6a8311150162f792fccc841de71`. Import/export/segment/dedup APIs + merge preflight |
| Batch 24B CRM workflow UI integration | MERGED | [PR #68](https://github.com/Holagpt-ai/webxxl-website-system/pull/68), `c3e599fe45ec913689a211d3cc5de3943c9ac388`, v0 @ `bc531bb` |
| Batch 25 CRM → Marketing audience planning | MERGED | [PR #69](https://github.com/Holagpt-ai/webxxl-website-system/pull/69), `4fbcc4e22f2d44d3bb68237fc43d5ac4c61ae0ab` |
| Batch 25.1 audience planning integrity | MERGED | [PR #70](https://github.com/Holagpt-ai/webxxl-website-system/pull/70), `cd6ec31421fee97fdf2ba924ad2fe6dd34095299` |
| Vercel production SHA (2026-10-31, PR #70) | DEPLOYED | Owner-reported Vercel deployment `dpl_45iEUe5hmadGgYjG8iTT5qcm5AsC`, state **READY**, SHA `cd6ec31421fee97fdf2ba924ad2fe6dd34095299`. SHA only |
| Batch 26A CRM audience planning UI (v0) | DELIVERED | `v0/crm-audience-26a` @ `110c071c05912f5eb6237ebecea23dc4fd9a4520` |
| Batch 26B CRM audience planning UI integration | MERGED | [PR #71](https://github.com/Holagpt-ai/webxxl-website-system/pull/71), `6a889b3221fe2149446669a2016d14fe6f67e82a`, v0 26A @ `110c071c` |
| Vercel production SHA (2026-10-31, PR #71) | DEPLOYED | GitHub deployment `7459563378` by `vercel[bot]`, Production **success**, 2026-10-31T14:00:53Z, SHA `6a889b3221fe2149446669a2016d14fe6f67e82a`. SHA only |
| Batch 27A Business Command Center backend | MERGED | [PR #72](https://github.com/Holagpt-ai/webxxl-website-system/pull/72) squash `aea38692a07dba356fdd3b6d54d95b6a9a562a57` (branch head had been `63398e18…` pre-merge). [`BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md`](platform/docs/BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md) |
| Vercel production SHA (2026-10-31, PR #72) | DEPLOYED | GitHub deployment `7460419502`, Production **success**, 2026-10-31T15:17:13Z, SHA `aea38692a07dba356fdd3b6d54d95b6a9a562a57`. SHA only |
| Batch 27A.2 overview integrity recovery | MERGED | [PR #73](https://github.com/Holagpt-ai/webxxl-website-system/pull/73), `ccbca6b0eef330d75a77cc9ae3af6adadb806309`. Cherry-pick of `edc21fd6…` |
| Vercel production SHA (2026-10-31, PR #73) | DEPLOYED | Vercel `dpl_Dz8ULG7kiAdZr499mZ6W7wnX1YyA` **READY**; GitHub deployment `7460984353`, Production **success**, SHA `ccbca6b0eef330d75a77cc9ae3af6adadb806309`. SHA only |
| Batch 27B Business Command Center UI (v0) | DELIVERED | `v0/business-command-center-27b` @ `25220431bf713ccd1bf10dfc3b5260b466c412bd` |
| Batch 27C Business Command Center UI integration | MERGED | [PR #74](https://github.com/Holagpt-ai/webxxl-website-system/pull/74), `828ac12e9968f84bd8e1bc42f44ba941c9551194`, v0 @ `25220431` |
| Vercel production SHA (2026-10-31, PR #74) | DEPLOYED | Vercel `dpl_5AuKd2RyiUqAgoNGr4XLSBS6rtj5` **READY** @ `828ac12e9968f84bd8e1bc42f44ba941c9551194`. SHA only |
| Batch 28A Managed-site lead intake & CRM qualification | MERGED | [PR #75](https://github.com/Holagpt-ai/webxxl-website-system/pull/75), `276ad9771b128dee0239b4a77e2d73e298f5d81a`. Branch tip pre-merge `7e9b127…`. Migration `20261031120000_batch28a_managed_site_leads` in Git only |
| Batch 28A.1 Intake integrity (auth, pagination, lifecycle, dedupe) | MERGED | Included in PR #75 merge @ `276ad97…` |
| Batch 28A.2 Intake payload idempotency fingerprint | MERGED | [PR #76](https://github.com/Holagpt-ai/webxxl-website-system/pull/76), `16755fc44de3fe699eba971564bdb1ceb3e403d7`; migration `20261031140000_batch28a_2_intake_payload_fingerprint` in Git only |
| Batch 28B CRM Lead Inbox UI (v0) | DELIVERED | `v0/crm-lead-inbox-28b` @ `f9e21907e1d0b53504ede6bc6e078658a7eb7edf` |
| Batch 28C Lead Inbox UI integration | MERGED | [PR #77](https://github.com/Holagpt-ai/webxxl-website-system/pull/77), `0135a8b7d0a40bf7830624e22b57319753921aec`, v0 @ `f9e21907` |
| Batch 29A Managed-site form connector V1 | MERGED | [PR #78](https://github.com/Holagpt-ai/webxxl-website-system/pull/78), `fc702c696fe0a35ef3b61f4dc3eb6dc896a06442`. [`BATCH29A-MANAGED-SITE-FORM-CONNECTOR.md`](platform/docs/BATCH29A-MANAGED-SITE-FORM-CONNECTOR.md) |
| Batch 29A.1 Connector submission identity & retry integrity | IN PR | Branch `feature/batch-29a-1-submission-identity` |
| Vercel production SHA (2026-10-31, PR #78) | DEPLOYED | Vercel `dpl_CUrcig1btP6LQy2CePa6DXmF87c9` **READY** @ `fc702c696fe0a35ef3b61f4dc3eb6dc896a06442`. SHA only |
| ADR-018, ADR-019, ADR-020 | PROPOSED | [`docs/adr/INDEX.md`](adr/INDEX.md). Not approved |

Batch 15, merged in PR #51, extends `lib/platform/analytics/` with capture, aggregation, and ingestion worker paths. `ANALYTICS_INGESTION_ENABLED`, `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED`, and `ANALYTICS_PROVIDER_FETCH_ENABLED` default off. No production activation without owner authorization.

## Batch 16 ownership (approved direction)

Recorded 2026-10-26 from an owner decision. This applies ADR-003 to the next customer-dashboard batch. It is not an implementation claim and it does not approve a vendor, a flag, or a migration.

- v0.app owns the complete CRM, Marketing Studio, and Local SEO customer dashboard UI/UX.
- Cursor owns backend, APIs, Prisma, integration engineering, tests, Git, and deployment engineering.
- No overlapping file edits. Exact file paths are named before the two owners work at the same time.
- English and Spanish stay in scope. Existing portal designs stay in place.

Batch 16 customer workspace UI is **MERGED** (PR #54). Batch 17A extends native CRM HTTP on the same architecture (CRM-05); it does not replace the vendor stack or enable flags.

## Architecture decision controls

- ADR-001 through ADR-017: the decision changelog only. Do not recreate those files.
- ADR-018+: [`docs/adr/`](adr/README.md). PROPOSED until the owner approves and the decision changelog records it.
- AUTO-10 stays Prisma-first. See [`docs/platform/docs/AUTO10-PROVIDER-DECISION.md`](platform/docs/AUTO10-PROVIDER-DECISION.md). Hatchet is not provisioned.

## Update protocol

A meaningful merge updates this file with the SHA, the PR, the date, and the owner. Deployment, migration, and flag facts change only when new evidence exists. Do not paste the Master TAD into this file.

## Cross-session commands

`WEBXXL HANDOFF` is the final session record. The field list is in [`AGENTS.md`](../AGENTS.md) and [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md). `PENDING REPOSITORY SYNC` means a material decision or status exists in ChatGPT or v0.app and is not yet committed. Each use names the fact, the target file, the responsible platform, and the next action. Clear it only after the commit is on a recorded pull request or on `main`. An open pull request is not merged.
