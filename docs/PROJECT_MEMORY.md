# WebXXL Project Memory

**Evidence review:** 2026-10-29 · **Repo:** `Holagpt-ai/webxxl-website-system` · **`main`:** `69981c4c9576e8cc43ebe83aa2b486f27db5a6f3` (PR #53)

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
- Approved free CRM, Marketing Studio, local SEO, and social capabilities are not silently repriced. Spend and provider use stay separately gated. Exact eligibility is still OPEN-001.
- Live billing, SMS, social publishing, Google ingestion, AI execution, and production migrations need their own authorization.

## Checkpoint

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
| Batch 16B customer workspace UI | IN PR | v0.app delivery on branch `v0/business-workspace-16b`, head `565935adde708eb66cef2c23603aef26a303ba51`. Combined with Batch 16C on integration PR (open for owner review). Not production-activated |
| Batch 16C dashboard integration | IN PR | Cursor: `lib/portal/modules.ts`, shared nav i18n, Local SEO path reconciliation, continuity docs. Same integration PR as 16B. Not merged |
| ADR-018, ADR-019, ADR-020 | PROPOSED | [`docs/adr/INDEX.md`](adr/INDEX.md). Not approved |

Batch 15, merged in PR #51, extends `lib/platform/analytics/` with capture, aggregation, and ingestion worker paths. `ANALYTICS_INGESTION_ENABLED`, `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED`, and `ANALYTICS_PROVIDER_FETCH_ENABLED` default off. No production activation without owner authorization.

## Batch 16 ownership (approved direction)

Recorded 2026-10-26 from an owner decision. This applies ADR-003 to the next customer-dashboard batch. It is not an implementation claim and it does not approve a vendor, a flag, or a migration.

- v0.app owns the complete CRM, Marketing Studio, and Local SEO customer dashboard UI/UX.
- Cursor owns backend, APIs, Prisma, integration engineering, tests, Git, and deployment engineering.
- No overlapping file edits. Exact file paths are named before the two owners work at the same time.
- English and Spanish stay in scope. Existing portal designs stay in place.

Batch 16A names those paths, the locked routes, and the API matrix in [`docs/platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md). PR #53 is **MERGED** at `69981c4c9576e8cc43ebe83aa2b486f27db5a6f3`. Batch 16B UI and Batch 16C integration are on one open pull request for owner review. Merge does not enable flags or activate providers.

## Architecture decision controls

- ADR-001 through ADR-017: the decision changelog only. Do not recreate those files.
- ADR-018+: [`docs/adr/`](adr/README.md). PROPOSED until the owner approves and the decision changelog records it.
- AUTO-10 stays Prisma-first. See [`docs/platform/docs/AUTO10-PROVIDER-DECISION.md`](platform/docs/AUTO10-PROVIDER-DECISION.md). Hatchet is not provisioned.

## Update protocol

A meaningful merge updates this file with the SHA, the PR, the date, and the owner. Deployment, migration, and flag facts change only when new evidence exists. Do not paste the Master TAD into this file.

## Cross-session commands

`WEBXXL HANDOFF` is the final session record. The field list is in [`AGENTS.md`](../AGENTS.md) and [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md). `PENDING REPOSITORY SYNC` means a material decision or status exists in ChatGPT or v0.app and is not yet committed. Each use names the fact, the target file, the responsible platform, and the next action. Clear it only after the commit is on a recorded pull request or on `main`. An open pull request is not merged.
