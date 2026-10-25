---
id: ADR-018
title: Selective third-party components versus platform replacement
status: PROPOSED
date: 2026-10-25
decision_owner: WebXXL owner
approval_evidence: NONE
source_decision: ADR-001; ADR-004; ADR-006; ADR-011; ADR-012; ADR-016
implementation_state: NOT_STARTED
production_state: NOT_ACTIVATED
supersedes: NONE
superseded_by: NONE
---

# ADR-018 — Selective third-party components versus platform replacement

## Context
WebXXL already owns customer identity, tenancy, billing, approvals, API contracts, audit and project lifecycle. Evaluation of Fimo-inspired operation, Strapi, Payload, Activepieces and Chatwoot raised the question of speeding development without importing duplicate systems. The Master TAD already requires provider-neutrality and no unapproved downgrades. This record formalizes a future **selection process**, not a previously authorized vendor rollout.

## Decision
**PROPOSED, not approved:** Integrate narrowly scoped, replaceable vendor capabilities when the independently verified time-to-value and maintenance case is better than building; do not replace WebXXL's core system of record. Demand one real use case, licensing and tenant isolation proof, security review, a scoped adapter, portability/exit, and an operating-cost comparison. Existing first-party workflow and data ownership remain unaffected unless separately approved.

## Options considered
| Option | Benefits | Costs/risks | Disposition |
|---|---|---|---|
| Selective adapter-based integration | Reuses mature functions; independent evolution | Adapter tests, upgrades, vendor costs | Proposed policy |
| Clone/replace core with all-in-one platform | Fast demos | Duplicate auth, tenancy, migrations, licensing and drift | Not proposed |
| Build all commodity tools internally | Full code control | Long development time and maintenance | Alternative case-by-case |

## Consequences
Potentially shorter implementation cycles and better provider exit. Adds vendor governance, deployment and upgrade work. A vendor cannot become authoritative for WebXXL billing, approvals, consent or authorization by accident.

## Compatibility and safety
No schema changes, migrations, feature activation or UI changes are authorized by this proposed policy. New adapters must be customer-account scoped and preserve independent sibling data, human approvals, reliable audit and explicit provider disabling. Commercial embedding/AGPL terms need release-specific review. New vendor integrations require their own scoped batch/owner approval.

## Evidence and links
- `docs/platform/docs/01-MASTER-TAD.md` — authoritative boundaries
- `docs/platform/docs/15-DECISIONS-CHANGELOG.md` — legacy ADRs listed above
- `docs/platform/docs/16-PROVIDER-REGISTER.md` — candidate status, licensing checks
- Project evaluation of Fimo, Strapi, Payload and Activepieces — discussion, not production evidence

## Approval and rollout
- Owner decision: PENDING
- Approval evidence: NONE
- Implementation: NOT_STARTED (policy documentation only)
- Production deployed: NO
- Migration applied: NO
- Activated: NO
- Verified live: NO
- Next authorized trigger: owner review of this formal selection policy; no impact to Batch 15
