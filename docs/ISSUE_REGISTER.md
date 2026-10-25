# Issues, Risks, and Deferrals

Status words: REPORTED, VERIFIED, IN PR, IN PROGRESS, BLOCKED, DEFERRED, RESOLVED, DISPROVEN. A claim becomes VERIFIED only with evidence. Each item has an owner and a reason to reopen it.

| ID | Status | Item | Evidence | Re-entry |
|---|---|---|---|---|
| CONT-001 | IN PR | Root README was the generic v0 starter | Replaced on `feature/webxxl-continuity-adr-v1` | Close when that PR merges |
| CONT-002 | IN PR | `02-CURRENT-STATE.md` header stopped at 2026-10-18 | Checkpoint for `c0a21db` added in this PR. Older "in PR" paragraphs kept as history | Close when that PR merges |
| CONT-003 | IN PR | No `.github/workflows` on `main` | Continuity, ADR, app, and deployment-evidence workflows added in this PR | Close when that PR merges |
| CONT-004 | IN PR | Batch 15 analytics ingestion and conversion pipeline | Branch `feature/webxxl-analytics-ingestion-15`. Flags default off | Close when Batch 15 PR merges after owner review |
| POLICY-OPEN-001 | BLOCKED | Who receives free CRM, Marketing Studio, and SEO before a website subscription | [`00-SESSION-START.md`](platform/docs/00-SESSION-START.md) and OPEN-001 in the decision log | Owner commercial decision |
| RELEASE-001 | DEFERRED | Production migration proof, provider activation, and real send tests | Separate owner authorization | Launch or activation gate |

Source defects need a path and a reproduction. Production defects need an environment, a date, and evidence. Do not reopen a deferred integration without an owner decision or a launch gate.
