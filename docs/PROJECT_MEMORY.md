# WebXXL Project Memory

**Evidence review:** 2026-11-13 · **Repo:** `Holagpt-ai/webxxl-website-system` · **`main`:** `627f9d6cc52755730ec7de773d98307200dd7469` (PR **#129** Batch 7B MERGED)

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
| 1 | Last verified checkpoint | GitHub `main` `627f9d6cc52755730ec7de773d98307200dd7469` ([PR **#129**](https://github.com/Holagpt-ai/webxxl-website-system/pull/129) Batch 7B admin/AI UI, MERGED 2026-11-13). Prior [PR **#128**](https://github.com/Holagpt-ai/webxxl-website-system/pull/128) @ `8585d93`. Issue #105 QA **deferred** to Batch 8. |
| 2 | GitHub SHA, branch, active PR | **`627f9d6cc52755730ec7de773d98307200dd7469`** on `main`. Active Batch **7C** integration PR on `feat/batch7c-public-conversion-integration` (owner review). v0 source `v0/public-conversion-7c` @ `5b3ff52`. [PR **#129**](https://github.com/Holagpt-ai/webxxl-website-system/pull/129) **MERGED**. |
| 3 | Production deployment | GitHub deployment **`7768203600`** Production **success** 2026-11-13T14:50:01Z @ `627f9d6cc52755730ec7de773d98307200dd7469`. SHA only. Not migration, activation, or provider live state. Batch 7C UI not yet merged. |
| 4 | Last updated | 2026-11-13 |
| 5 | Next task / responsible platform | **Batch 7C** public conversion UI integration — **Cursor** (owner review PR). Then **Batch 8 — Release & Activation** (no broad acceptance in 7C). Mailbox verify `hello@webbxxl.com` deferred to Batch 8. |
| 6 | Open blocker / gate IDs | Issue **#105** QA **deferred**. CRM-SUBNAV-105 **REPORTED**. POLICY-SUB-001 **REPORTED**. RELEASE-001 gated. Issue **#109** remains the execution roadmap. Staging migrations last **39/39** (2026-11-03); not re-counted 2026-11-13. Production migrate **UNVERIFIED**. Flags **not activated**. Provider activation **UNVERIFIED**. AI execution, outbound, workflow cron, and external effects remain disabled. |

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
| Batch 29A.1 Connector submission identity & retry integrity | MERGED | [PR #79](https://github.com/Holagpt-ai/webxxl-website-system/pull/79), `3905994ebbb8c4b423481c961a65e938dfc76a59` |
| Batch 30A + 30A.1 Lead funnel reporting & Business Command Center integration | MERGED | [PR #80](https://github.com/Holagpt-ai/webxxl-website-system/pull/80), `cb8d785d7ca4eb4ac26972a7db69b4a0e65b0b2f`. [`BATCH30A-LEAD-FUNNEL-REPORTING-API-CONTRACT.md`](platform/docs/BATCH30A-LEAD-FUNNEL-REPORTING-API-CONTRACT.md) |
| Vercel production SHA (2026-10-31, PR #80) | DEPLOYED | Vercel `dpl_Fev1t4X7U9EFvzXA7wCZHVUAjiLC` **READY** @ `cb8d785d7ca4eb4ac26972a7db69b4a0e65b0b2f`. SHA only |
| Batch 30B Lead Funnel dashboard UI (v0) | DELIVERED | `v0/lead-funnel-30b` @ `e4e85b2af0db01fb76bf23854dbe834bdb3af1a0` |
| Batch 30C Lead Funnel UI integration | MERGED | [PR #81](https://github.com/Holagpt-ai/webxxl-website-system/pull/81), `3a7d011466aeabcf4c2d3bdfe8a669d42e448957`, v0 @ `e4e85b2…` |
| Vercel production SHA (2026-10-31, PR #81) | DEPLOYED | Vercel `dpl_A6Lx8wv62nsXeGY7mUFcshLhDP89` **READY** @ `3a7d011466aeabcf4c2d3bdfe8a669d42e448957`. SHA only |
| Batch 31 + 31.1 Controlled staging + synthetic pilot foundation | MERGED | [PR #82](https://github.com/Holagpt-ai/webxxl-website-system/pull/82), `93e3010d097b3e08fa47be9492c57ed3999d2f03`, [`BATCH31-CONTROLLED-STAGING-PILOT.md`](BATCH31-CONTROLLED-STAGING-PILOT.md) |
| Batch 32 + 32.1 Commerce, wallet & fulfillment integrity V1 | MERGED | [PR #83](https://github.com/Holagpt-ai/webxxl-website-system/pull/83), `b8e58dfc7a1520cb927e67785137734d4ed3d637`, [`BATCH32-COMMERCE-WALLET-INTEGRITY.md`](platform/docs/BATCH32-COMMERCE-WALLET-INTEGRITY.md) |
| Vercel production SHA (2026-11-01, PR #83) | DEPLOYED | Vercel `dpl_CMoTpuKRNKU1ejgE9HaiJRqTUTac` **READY** @ `b8e58dfc7a1520cb927e67785137734d4ed3d637`. SHA only |
| Batch 33 SEO & analytics Google integration prep V1 (+ 33.1, 33.2) | MERGED | [PR #84](https://github.com/Holagpt-ai/webxxl-website-system/pull/84), `1ae7c0a1e13748969ead7f3b177a74fcc68ed5d8`, [`BATCH33-SEO-ANALYTICS-INTEGRATION-PREP.md`](platform/docs/BATCH33-SEO-ANALYTICS-INTEGRATION-PREP.md) |
| Vercel production SHA (2026-11-01, PR #84) | DEPLOYED | GitHub deployment `7478496108`, Production success @ `1ae7c0a1e13748969ead7f3b177a74fcc68ed5d8`. SHA only |
| Batch 34 Marketing Studio execution gates V1 | MERGED | [PR #85](https://github.com/Holagpt-ai/webxxl-website-system/pull/85), `e400c49df62b99069110cadd59c0f721e676ea35`, [`BATCH34-MARKETING-EXECUTION-GATES.md`](platform/docs/BATCH34-MARKETING-EXECUTION-GATES.md) |
| Vercel production SHA (2026-11-01, PR #85) | DEPLOYED | Vercel `dpl_A7yAQkZD7T994YnSjGwhae1PuBL1` **READY** @ `e400c49df62b99069110cadd59c0f721e676ea35`. SHA only |
| Batch 35 Unified communications integration V1 | MERGED | [PR #86](https://github.com/Holagpt-ai/webxxl-website-system/pull/86), `3386ac6a5ca8c406ad1bc8c6259726a4c134060e`. [`BATCH35-UNIFIED-COMMUNICATIONS-INTEGRATION.md`](platform/docs/BATCH35-UNIFIED-COMMUNICATIONS-INTEGRATION.md). No live sends |
| Vercel production SHA (2026-11-01, PR #86) | DEPLOYED | Vercel `dpl_DB2fCd4wt9C6htqVNU125jCUUYJh` **READY** @ `3386ac6`. SHA only. Superseded by PR #87 row |
| Batch 36 Customer AI Workforce pilot prep V1 | MERGED | [PR #87](https://github.com/Holagpt-ai/webxxl-website-system/pull/87), `f620e4f1c7a0c6cbcecf2bca8365b8e4cae6c646`. [`BATCH36-CUSTOMER-AI-PILOT-V1.md`](platform/docs/BATCH36-CUSTOMER-AI-PILOT-V1.md). Preparation + approval binding only; no LLM execution |
| Vercel production SHA (2026-11-01, PR #87) | DEPLOYED | Owner-verified Vercel `dpl_Hr8m2PMTYFoEoDN38M8czCi39TJF` **READY** @ `f620e4f`. SHA only. Not migration or activation |
| Batch 43 staging pilot provision safeguards | MERGED | [PR #104](https://github.com/Holagpt-ai/webxxl-website-system/pull/104) merge `19b935a7471244009347ad2b25aea57c89b3cc21` on 2026-11-03. Branch head before merge `299a0fe09b3b9c792705c412240707ae77d8cdfa`. No live staging apply in that PR |
| Vercel production SHA (2026-11-03, PR #104) | DEPLOYED | GitHub deployment `7526284530`, Production **success**, 2026-11-03T17:45:04Z, SHA `19b935a7471244009347ad2b25aea57c89b3cc21`. SHA only. Superseded for current production by the PR #95 row |
| PR #95 legal placeholder notice | MERGED | `a43b276d1005d29e9928c40fb66d6874bd7f06d8`. Legal copy only. Not a CRM, migration, or flag change |
| Vercel production SHA (2026-11-06, PR #95) | DEPLOYED | GitHub deployment `7608137512`, `vercel[bot]`, Production **success**, 2026-11-06T18:47:08Z, SHA `a43b276d1005d29e9928c40fb66d6874bd7f06d8`. SHA only. Vercel deployment id was not in the GitHub payload. Not migration or activation |
| Staging Preview (Batch 43 source, 2026-11-05) | DEPLOYED | GitHub deployment `7526261591`, Preview **success**, latest status 2026-11-05T18:30:43Z, SHA `299a0fe09b3b9c792705c412240707ae77d8cdfa`. SHA only. Issue #105 names Vercel `dpl_FqymPkk81pgYqpk35mrPyEMUTDgR`; that id was not in the GitHub payload |
| Issue #105 CRM page entitlement + layout | MERGED | [PR #106](https://github.com/Holagpt-ai/webxxl-website-system/pull/106), `e37f0a023dd289dc3a9b4e7484f6a1dd34b24276`, merge 2026-11-07. v0 integration `212fdf43d3dafeec906a5527cbefea0d78983cb5`. Pilot A/B core entitlement acceptance **passed** on integrated staging Preview (Issue #105). Broader Issue #105 QA **deferred** to release stabilization (Issue #109) |
| Issue #109 execution roadmap | MERGED | [PR #110](https://github.com/Holagpt-ai/webxxl-website-system/pull/110), `fcceade889cefd1c14f86bdbb723f5a0ad97c547`, merge 2026-11-07. Build-first batches 0–8 registered |
| Batch 1 Customer Operations Engine | MERGED | [PR **#112**](https://github.com/Holagpt-ai/webxxl-website-system/pull/112) @ `52e6bb6` — `GET /api/v1/customer-operations/summary` | [`BATCH1-CUSTOMER-OPERATIONS-API-CONTRACT.md`](platform/docs/BATCH1-CUSTOMER-OPERATIONS-API-CONTRACT.md) |
| Batch 2 site SEO & analytics intelligence | MERGED | [PR **#115**](https://github.com/Holagpt-ai/webxxl-website-system/pull/115) @ `9f3fc66` — `GET /api/v1/site-intelligence/sites/[siteId]/summary` | [`BATCH2-SITE-INTELLIGENCE-API-CONTRACT.md`](platform/docs/BATCH2-SITE-INTELLIGENCE-API-CONTRACT.md) |
| Batch 3 marketing & social execution (backend) | MERGED | [PR **#118**](https://github.com/Holagpt-ai/webxxl-website-system/pull/118) @ `c9a67b065a0d665f0f66bddcfae932eb85cb489d` — `GET /api/v1/marketing/execution/summary` + `prepareApprovedCreativeSocialHandoff` | [`BATCH3-MARKETING-EXECUTION-API-CONTRACT.md`](platform/docs/BATCH3-MARKETING-EXECUTION-API-CONTRACT.md) |
| Batch 3 marketing execution UI (v0 Stage B) | MERGED | [PR **#120**](https://github.com/Holagpt-ai/webxxl-website-system/pull/120) @ `6015d907262fd655919b8419369716a8f40d41dd` — Marketing Studio execution panels | [`BATCH3-MARKETING-EXECUTION-API-CONTRACT.md`](platform/docs/BATCH3-MARKETING-EXECUTION-API-CONTRACT.md) |
| Vercel production SHA (2026-11-08, PR #120) | DEPLOYED | Vercel `dpl_HaRLJcFCRwZCLNZz8FLPYLQDoEST` **READY** @ `6015d907262fd655919b8419369716a8f40d41dd`. SHA only. Not migration or activation |
| Vercel production SHA (2026-11-08, PR #122) | DEPLOYED | Vercel `dpl_GywPHGTHr3jDH1U9gQmsAL1dNDv1` **READY** @ `c488b10a6143a7b358e0f88158ac09ea91289815`. SHA only. Not migration or activation |
| Issue #121 post-merge stale-template fix | MERGED | [PR **#123**](https://github.com/Holagpt-ai/webxxl-website-system/pull/123) @ `259f6be2be0774e90f1f77bfce1911be462420da`, merge 2026-11-08 | Handoff template stale-scan exclusion |
| Vercel production SHA (2026-11-08, PR #123) | DEPLOYED | Vercel `dpl_E8aaezK3z3G5HQNH11RDBRbRNiXr` **READY** @ `259f6be2be0774e90f1f77bfce1911be462420da`. SHA only. Not migration or activation |
| CONTINUITY-04 session lifecycle | MERGED | [PR **#122**](https://github.com/Holagpt-ai/webxxl-website-system/pull/122) Issue **#121** @ `c488b10a6143a7b358e0f88158ac09ea91289815`, merge 2026-11-08 — `pnpm continuity:start` / `checkpoint` / `close`, live status artifact, ADR anchor checks | [`CONTINUITY-04-SESSION-LIFECYCLE.md`](CONTINUITY-04-SESSION-LIFECYCLE.md) |
| Issue #121 ISSUE_REGISTER post-merge classifier | MERGED | [PR **#124**](https://github.com/Holagpt-ai/webxxl-website-system/pull/124) @ `5cc8d416ef4059ba507c231afb34e95b6a587c7c`, merge 2026-11-08 | Register lag → PENDING_REPOSITORY_SYNC |
| Batch 4 communications & messaging wallet | MERGED | [PR **#125**](https://github.com/Holagpt-ai/webxxl-website-system/pull/125) @ `c27c6810e61825fd5a99a9a0d994c1bda704c871` — `GET /api/v1/communications/execution/summary` + guarded prepare + wallet bridge | [`BATCH4-COMMS-MESSAGING-WALLET-API-CONTRACT.md`](platform/docs/BATCH4-COMMS-MESSAGING-WALLET-API-CONTRACT.md) |
| Vercel production SHA (2026-11-09, PR #125) | DEPLOYED | Vercel `dpl_Agrh29ThShz8cmB5kHtkjHhpi64n` **READY** @ `c27c6810e61825fd5a99a9a0d994c1bda704c871`. SHA only. Not migration or activation |
| Batch 5 commerce & managed services | MERGED | [PR **#126**](https://github.com/Holagpt-ai/webxxl-website-system/pull/126) squash `dd109204c3089ddef6ba03770c70d33b0d8455d3` on 2026-11-09. Branch head before merge `5cfb9d0cfe00b705d4fd1814698d2b7b98497747` — `GET /api/v1/commerce/execution/summary` + managed-service lifecycle honesty + payment readiness | [`BATCH5-COMMERCE-MANAGED-SERVICES-API-CONTRACT.md`](platform/docs/BATCH5-COMMERCE-MANAGED-SERVICES-API-CONTRACT.md) |
| Vercel production SHA (2026-11-09, PR #126) | DEPLOYED | GitHub deployment `7656576538` Production **success** 2026-11-09T13:58:17Z @ `dd109204c3089ddef6ba03770c70d33b0d8455d3`. Coordinator-reported Vercel `dpl_DdxJbNwAzaWp9u7wKN8m3SQgoUxH` **READY** (id not in the GitHub payload). SHA only. Not migration or activation |
| Batch 6 AI workforce & automation | MERGED | [PR **#127**](https://github.com/Holagpt-ai/webxxl-website-system/pull/127) squash `c7bec5e7def89d60f89cdaa0d339decfb6f0ab6b` on 2026-11-13 — verified approvals, staff gates, execution summaries | [`BATCH6-AI-WORKFORCE-AUTOMATION-API-CONTRACT.md`](platform/docs/BATCH6-AI-WORKFORCE-AUTOMATION-API-CONTRACT.md) |
| Vercel production SHA (2026-11-13, PR #127) | DEPLOYED | GitHub deployment `7753430399` Production **success** @ `c7bec5e7def89d60f89cdaa0d339decfb6f0ab6b`. SHA only. Not migration or activation |
| Batch 7 platform admin backend | MERGED | [PR **#128**](https://github.com/Holagpt-ai/webxxl-website-system/pull/128) @ `8585d93df7c407b84942f2e7eb82fd38beea9d6f` | [`BATCH7-PLATFORM-ADMIN-OPERATIONS-API-CONTRACT.md`](platform/docs/BATCH7-PLATFORM-ADMIN-OPERATIONS-API-CONTRACT.md) |
| Batch 7B admin + AI employees UI | MERGED | [PR **#129**](https://github.com/Holagpt-ai/webxxl-website-system/pull/129) @ `627f9d6cc52755730ec7de773d98307200dd7469` | [`BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md) |
| Vercel production SHA (2026-11-13, PR #129) | DEPLOYED | GitHub deployment `7768203600` Production **success** @ `627f9d6cc52755730ec7de773d98307200dd7469`. SHA only. Not migration or activation |
| Batch 7C public conversion + responsive UI | IN PR | v0 `v0/public-conversion-7c` @ `5b3ff52` → Cursor integration branch; 11-file frontend scope | [`BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md) (§ Batch 7C) |
| CONTINUITY-03 session closeout | MERGED | [PR #108](https://github.com/Holagpt-ai/webxxl-website-system/pull/108), `5d90c124b1c7a884f7a61f16e5b9d263f0c08081`, merge 2026-11-07. Issue **#107** **CLOSED**. `pnpm continuity:close` + CI reconcile |
| Vercel production SHA (2026-11-07, PR #106) | DEPLOYED | Vercel `dpl_AzZVHN5Si3jShjcJf5Gtq1dCxdAb` **success** @ `e37f0a023dd289dc3a9b4e7484f6a1dd34b24276`. GitHub commit status via `vercel[bot]`, 2026-11-07T18:01:23Z. SHA only. Superseded for current production by PR #108 row |
| Vercel production SHA (2026-11-07, PR #108) | DEPLOYED | Vercel `dpl_HR1qq83Cz2ARKUvaRf8URt2Piwpo` **success** @ `5d90c124b1c7a884f7a61f16e5b9d263f0c08081`. GitHub commit status via `vercel[bot]`, 2026-11-07T19:07:53Z. SHA only. Not migration or activation |
| PR #100 Batch 40 documentation closeout | MERGED | [PR #100](https://github.com/Holagpt-ai/webxxl-website-system/pull/100), `f8261810244a21f3f92cde3b9a757fd8f0f77783`. Docs closeout only. Deploy UNVERIFIED. No new migration. |
| Vercel production SHA (2026-10-31, PR #79) | DEPLOYED | Vercel `dpl_AQ2v84aWrtDkogkczTeuMM24CHc9` **READY** @ `3905994ebbb8c4b423481c961a65e938dfc76a59`. Superseded by PR #80 row |
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

## Proposed remaining work (Batches 31–38) — not approved implementation

Consolidated **directional** roadmap for owner planning. Status is **MERGED** only where an evidence row or changelog entry already records that merge. A merge is not activation, deployment, or production verification. These batches do not override Master TAD or ADR-001..017. No production migration, flag activation, or provider connection is implied.

| Batch | Theme | Primary owner | Depends on | Status |
|---|---|---|---|---|
| **31** | Controlled staging pilot execution (OPEN-001 cohort, read-only → gated writes) | Cursor + Owner | 21B/21C, INFRA-02 gate | MERGED |
| **32** | Commerce & wallet fulfillment (group checkout, reservations, reconciliation hardening) | Cursor | WALLET-09/COMMERCE-11 source on `main` | MERGED |
| **33** | SEO & analytics activation prep (ingestion flags, GSC/GA4 connection UX, conversion integrity) | Cursor + v0 | ANALYTICS-14/15 merged source | MERGED |
| **34** | Marketing Studio execution gates (draft → approval → guarded publish/send boundaries) | Cursor + v0 | MKT-08, SOCIAL-04 | MERGED |
| **35** | Communications live pilot (Chatwoot relay, consent-aware inbox, no broadcast bypass) | Cursor + v0 | COMMS-06, Batch 20C UI | MERGED |
| **36** | Customer AI workforce pilot (scoped tools, human approval, no autonomous outreach) | Cursor + v0 | AI-CUSTOMER-13, AGENT-03 | MERGED |
| **37** | Infrastructure & durable execution fulfillment (worker cron, outbox, AUTO-10 provider decision) | Cursor | AUTO-10, owner VPS/worker approval | MERGED |
| **38** | Release stabilization & customer acceptance (staging e2e, migration rehearsal, signoff gate) | Owner + Cursor | Prior batches owner-selected for pilot | MERGED |

## Update protocol

A meaningful merge updates this file with the SHA, the PR, the date, and the owner. Deployment, migration, and flag facts change only when new evidence exists. Do not paste the Master TAD into this file.

## Cross-session commands

`WEBXXL HANDOFF` is the final session record. The field list is in [`AGENTS.md`](../AGENTS.md) and [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md). `PENDING REPOSITORY SYNC` means a material decision or status exists in ChatGPT or v0.app and is not yet committed. Each use names the fact, the target file, the responsible platform, and the next action. Clear it only after the commit is on a recorded pull request or on `main`. An open pull request is not merged.
