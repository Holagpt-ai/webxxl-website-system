# CONTINUITY-04 — Session lifecycle and live memory sync

**Issue:** [#121](https://github.com/Holagpt-ai/webxxl-website-system/issues/121) · **Supersedes operational detail in:** [`CONTINUITY-03-SESSION-CLOSEOUT.md`](CONTINUITY-03-SESSION-CLOSEOUT.md) (closeout exit codes and CI gates remain binding)  
**ADR:** not required (governance tooling; Master TAD unchanged)

## Purpose

Keep project memory, session handoffs, operational anchors, and the ADR index **evidence-aligned** without repeating full-repository audits. Distinguish **live derived** GitHub `main` from **last reconciled** checkpoint field 2 (the docs snapshot SHA).

## Commands (one engine)

| Command | When | Output |
|---|---|---|
| `pnpm continuity:start` | Session start | Human report; `--json` for machine payload (`status`, `reasonCode`, `evidenceAsOf`) |
| `pnpm continuity:checkpoint` | After PR open/merge, deploy evidence, or owner decision | Lightweight re-run; same schema |
| `pnpm continuity:close` | Before **WEBXXL HANDOFF** | Full closeout + exit code |
| `pnpm continuity:reconcile` | CI (`check-continuity-reconcile.mjs`) | Blocking contradictions; artifacts on Actions |

### Exit codes (`close` / CI blocking)

| Code | Status |
|---|---|
| 0 | `SYNCHRONIZED` |
| 2 | `PENDING_REPOSITORY_SYNC` (e.g. post-merge checkpoint lag on `push:main`) |
| 1 | `CONFLICT` (merged PR still OPEN, checkpoint pair mismatch, ADR drift, false-current anchors) |

`SYNCHRONIZED` never implies Vercel proof, migrations, flags, or provider activation.

## Live vs reconciled

| Concept | Source |
|---|---|
| Live `main` | `origin/main`, `GITHUB_SHA` on `push:main`, optional `gh` merged-PR list |
| Last reconciled | Checkpoint field 2 in `PROJECT_MEMORY.md` + `SESSION_HANDOFF.md` (must match) |
| Post-merge gap | Ancestor lineage: newer `main` with older but valid field 2 → **PENDING**, not self-referential CONFLICT |

On every Continuity workflow run, Actions uploads `continuity-live-status.json` (**detection only**). A green job does **not** mean docs were auto-updated.

## Post-merge docs sync (owner gate)

- **Cursor** reconciles checkpoint docs in the same implementation PR whenever possible.
- A **single** optional bot docs-sync PR (upsert branch) is **prepared but disabled** until the owner enables GitHub write automation (`continuity-live-status.json` → `bot_docs_sync_pr.enabled: false`).
- No auto-merge. No recursive bot loop on docs-only merges.

## Session checklist

1. `pnpm continuity:start` — note live `main` vs field 2.
2. Implement bounded batch; update impacted living-blueprint files.
3. `pnpm continuity:checkpoint` after material transitions.
4. Keep six-field checkpoint **identical** in PROJECT_MEMORY and SESSION_HANDOFF.
5. `pnpm continuity:close` — resolve **CONFLICT** in the PR; record **PENDING** with owner action.
6. Emit **WEBXXL HANDOFF** from verified facts only.

## CI artifacts

| File | Role |
|---|---|
| `post-merge-pending-sync.json` | Deduped pending rows (Issue #109 tracking) |
| `continuity-live-status.json` | Live `main`, documented `main`, reason code, recent merges |

## Related scripts

- `scripts/continuity-lifecycle.mjs` — shared phases
- `scripts/continuity-live.mjs` — read-only GitHub facts
- `scripts/continuity-docs-snapshot.mjs` — idempotent snapshot helper (manual `--write` only)
- `scripts/validate-operational-anchors.mjs` — false-current anchor checks
- `scripts/validate-adr.mjs` — index status + supersession reciprocity
