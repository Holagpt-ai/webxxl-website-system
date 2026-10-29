# Issues, Risks, and Deferrals

Status words: REPORTED, VERIFIED, IN PR, IN PROGRESS, BLOCKED, DEFERRED, RESOLVED, DISPROVEN. A claim becomes VERIFIED only with evidence. Each item has an owner and a reason to reopen it.

| ID | Status | Item | Evidence | Re-entry |
|---|---|---|---|---|
| CONT-001 | RESOLVED | Root README was the generic v0 starter | Replaced on `main` by PR #50 (`622b352592f2cdcb359034e1c6462cb62130b1d1`) | Reopen if the root README returns to the v0 starter |
| CONT-002 | RESOLVED | `02-CURRENT-STATE.md` header stopped at 2026-10-18 | PR #50 added the `c0a21db` checkpoint. This continuity sync moves the header to PR #51 | Reopen if the current-state header lags a merged batch |
| CONT-003 | RESOLVED | No `.github/workflows` on `main` | Continuity, ADR, app, and deployment-evidence workflows landed in PR #50 | Reopen if the continuity workflow is removed |
| CONT-004 | RESOLVED | Batch 15 analytics ingestion and conversion pipeline | Merged as PR #51 (`f315e897218a48bfac44a0d50724c91d32b6c9c9`). Flags stay default off. Activation was not part of the merge | Reopen for an activation or migration defect that has new evidence |
| POLICY-OPEN-001 | RESOLVED | OPEN-001: website subscribers receive included FREE business software; cohort **SUBSCRIBER_ONLY** (2026-10-29); enforcement on `main` @ `c6d122` via `lib/platform/open001/` | [`15-DECISIONS-CHANGELOG.md`](platform/docs/15-DECISIONS-CHANGELOG.md), [`00-SESSION-START.md`](platform/docs/00-SESSION-START.md) | Reopen only with explicit owner policy change |
| CONT-005 | RESOLVED | Documentation overlap between **PR #64** and **CONTINUITY-02** reconciled on rebase of `docs/webxxl-continuity-02` onto `c6d122` | PR #65 push | Reopen if PR #65 reintroduces conflicting checkpoint facts without merge |
| POLICY-SUB-001 | REPORTED | Commercial treatment of `PAST_DUE` and `CANCEL_SCHEDULED` website subscriptions for OPEN-001 eligibility (grace vs hard deny) | `subscriber-eligibility.ts` qualifies all three today; no separate owner grace policy recorded | Owner commercial clarification — do not change status semantics without decision |
| RELEASE-001 | DEFERRED | Production migration proof, provider activation, and real send tests | Separate owner authorization | Launch or activation gate |

Source defects need a path and a reproduction. Production defects need an environment, a date, and evidence. Do not reopen a deferred integration without an owner decision or a launch gate.
