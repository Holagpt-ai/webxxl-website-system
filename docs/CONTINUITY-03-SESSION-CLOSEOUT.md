# CONTINUITY-03 — Session closeout protocol

**Issue:** [#107](https://github.com/Holagpt-ai/webxxl-website-system/issues/107)  
**ADR:** not required (operational continuity tooling; Master TAD unchanged)

## Purpose

Prevent WebXXL sessions from treating stale memory, outdated PR statuses, incomplete handoffs, or unverified deployments as current facts. The closeout path is **read-only**: it never mutates git, production, Vercel, migrations, flags, or providers.

## Commands

| Command | Role |
|---|---|
| `pnpm continuity:close` | End-of-session handoff for Cursor. Prints the six-field snapshot, evidence notes, and exit code. |
| `pnpm continuity:reconcile` | Same reconcile engine as CI (`scripts/check-continuity-reconcile.mjs`). |

### Exit codes (`pnpm continuity:close`)

| Code | Status | Meaning |
|---|---|---|
| 0 | `SYNCHRONIZED` | No deterministic contradictions; no pending sync items |
| 2 | `PENDING_REPOSITORY_SYNC` | No contradictions; `PENDING REPOSITORY SYNC` items or unavailable external checks flagged |
| 1 | `CONFLICT` | Fix before declaring engineering complete |

## Evidence use

1. **GitHub** — optional `gh` reads for merged PR state and Vercel commit status on the reference `main` SHA.
2. **Repository docs** — canonical six-field checkpoint must match in `docs/PROJECT_MEMORY.md` and `docs/SESSION_HANDOFF.md`.
3. **Stale operational rows** — MERGED items in `PROJECT_MEMORY` must not still read **IN PR** in scanned operational docs.
4. **ADR registry** — PROPOSED records cannot carry false APPROVED signals (`validate-adr.mjs`).

CI does **not** require the documentation commit SHA to equal checkpoint field 2. After a merge, the next PR may update the checkpoint while branch `HEAD` is still behind until docs land; post-merge pushes to `main` compare checkpoint field 2 to `GITHUB_SHA`.

Unavailable GitHub or Vercel API data produces a **notice**, not a failure.

## Session end checklist (Cursor)

1. Update impacted living-blueprint files in the working PR.
2. Keep the six-field checkpoint **identical** in `PROJECT_MEMORY.md` and `SESSION_HANDOFF.md`.
3. Run `pnpm continuity:close`.
4. Resolve **CONFLICT** or record **PENDING_REPOSITORY_SYNC** with owner action.
5. Emit **WEBXXL HANDOFF** with verified facts only.

## CI

`.github/workflows/continuity.yml` runs `node scripts/check-continuity-reconcile.mjs` on every pull request and every push to `main`. Deterministic contradictions fail the job.

## Related scripts

- `scripts/continuity-parse.mjs` — checkpoint and SHA parsing
- `scripts/continuity-reconcile.mjs` — reconcile engine
- `scripts/check-stale-operational-status.mjs` — advisory warnings (non-blocking)
- `scripts/validate-continuity.mjs` — shape and required files
