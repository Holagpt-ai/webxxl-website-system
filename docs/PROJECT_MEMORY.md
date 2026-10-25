# WebXXL Project Memory

**Evidence review:** 2026-10-25 · **Repo:** `Holagpt-ai/webxxl-website-system` · **`main`:** `c0a21db93d730c838fc58d9b862ed547927bd72f`

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
| Vercel production SHA | DEPLOYED | GitHub deployment `7233002736` by `vercel[bot]`, environment Production, state success, 2026-10-21T17:41:12Z, same SHA as `main` |
| Production migrations | UNVERIFIED | Not read from the production database |
| Analytics flags | Source default OFF; production values UNVERIFIED | `config/analytics-backend.ts`, `config/features.ts` `analyticsBackend: false` |
| Batch 15 ingestion pipeline | PLANNED | No merged Batch 15 pull request on 2026-10-25 |
| ADR-018, ADR-019, ADR-020 | PROPOSED | [`docs/adr/INDEX.md`](adr/INDEX.md). Not approved |

Gated analytics helpers already exist under `lib/platform/analytics/ingestion/`. They are not Batch 15 and they are not an enabled pipeline. `ANALYTICS_INGESTION_ENABLED` and `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED` default off.

## Architecture decision controls

- ADR-001 through ADR-017: the decision changelog only. Do not recreate those files.
- ADR-018+: [`docs/adr/`](adr/README.md). PROPOSED until the owner approves and the decision changelog records it.
- AUTO-10 stays Prisma-first. See [`docs/platform/docs/AUTO10-PROVIDER-DECISION.md`](platform/docs/AUTO10-PROVIDER-DECISION.md). Hatchet is not provisioned.

## Update protocol

A meaningful merge updates this file with the SHA, the PR, the date, and the owner. Deployment, migration, and flag facts change only when new evidence exists. Do not paste the Master TAD into this file.
