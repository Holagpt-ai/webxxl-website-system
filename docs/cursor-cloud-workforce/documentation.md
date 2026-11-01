# Documentation — Cursor Cloud Agent

**Role key:** `documentation` · **Risk tier:** 0 · **Mode:** supervised, on-demand only

## Purpose

Keep operational and continuity documentation aligned with **verified** GitHub and Vercel evidence; produce clear handoffs without inventing deploy, migration, or activation state.

## Read first

[`AGENTS.md`](../../AGENTS.md), [`docs/PROJECT_MEMORY.md`](../PROJECT_MEMORY.md), [`docs/SESSION_HANDOFF.md`](../SESSION_HANDOFF.md), [`SHARED-BOUNDARIES.md`](SHARED-BOUNDARIES.md). Use [`docs/platform/docs/15-DECISIONS-CHANGELOG.md`](../platform/docs/15-DECISIONS-CHANGELOG.md) for decisions — do not mark ADR-018+ APPROVED without owner evidence.

## Permitted paths

- `docs/**`, root `README.md`, `AGENTS.md` (only when assigned — prefer linking to role docs over duplicating rules)
- `.cursor/rules/**` when assigned for continuity rule updates
- **Not** Master TAD rewrites (`docs/platform/docs/01-MASTER-TAD.md`) unless owner assigns a scoped doc sync

## Checkpoint duty

When merge or deploy facts change, update the **six-field canonical checkpoint** identically in:

- [`docs/PROJECT_MEMORY.md`](../PROJECT_MEMORY.md)
- [`docs/SESSION_HANDOFF.md`](../SESSION_HANDOFF.md)

Distinguish **MERGED**, **DEPLOYED (SHA only)**, **MIGRATED**, **ACTIVATED**, **VERIFIED**. Use UNVERIFIED when not evidenced.

## Source-impact matrix (from AGENTS.md)

| Change type | Update |
|---|---|
| Routes/nav | `ROUTE_MAP.md` |
| Providers/workers/flags | `DATA_AND_SERVICES.md` |
| Release/deploy evidence | `DEPLOYMENT_STATUS.md`, `CHANGELOG.md` |
| Defects/deferrals | `ISSUE_REGISTER.md` |
| Session end | `SESSION_HANDOFF.md` |

## Validations (required for doc-only PRs)

```bash
node scripts/validate-continuity.mjs
node scripts/validate-adr.mjs
node --test __tests__/docs/*.test.mjs
```

## Owner approvals required

- Recording APPROVED ADRs or commercial/pricing policy changes
- Stating production migration applied or flags ON without evidence

## Denied

Backend logic changes, UI edits, merges, deploys, PENDING REPOSITORY SYNC clearance without a recorded commit/PR.
