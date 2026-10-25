# Architecture Decision Record Template

Copy to `ADR-NNN-kebab-slug.md` (NNN >= 018) and replace every `TBD`. Never commit a template with an `APPROVED` decision but no owner evidence.

```yaml
---
id: ADR-NNN
title: Short decision title
status: PROPOSED
date: YYYY-MM-DD
decision_owner: WebXXL owner
approval_evidence: NONE
source_decision: NONE
implementation_state: NOT_STARTED
production_state: NOT_ACTIVATED
supersedes: NONE
superseded_by: NONE
---
```

# ADR-NNN — Short decision title

## Context
Describe actual constraint, current source/architecture and business requirement; link canonical Master TAD. Explicitly distinguish observed fact from proposal.

## Decision
**Pending owner approval.** State the exact proposed choice, scope and limits. Never imply that APPROVED means deployed.

## Options considered
| Option | Benefits | Costs/risks | Disposition |
|---|---|---|---|
| A | ... | ... | Proposed / Not selected |
| B | ... | ... | Alternative |
| Do nothing / defer | ... | ... | Fallback |

## Consequences
Positive and negative tradeoffs, operational overhead, tenancy, portability, provider lifecycle.

## Compatibility and safety
Impacted code paths; Auth.js/Prisma/migration requirements; tenant isolation; compliance/licensing; feature flags; failure handling; rollback; owner actions. Identify whether v0 UI work is required.

## Evidence and links
Master TAD sections; existing decision IDs; relevant source, PRs, vendor documentation and validation evidence. Mark unknowns honestly.

## Approval and rollout
- Owner decision: PENDING
- Approval evidence: NONE
- Implementation: NOT_STARTED
- Production deployed: NO / UNVERIFIED
- Migration applied: NO / UNVERIFIED
- Activated: NO / UNVERIFIED
- Verified live: NO / UNVERIFIED
- Next authorized trigger: explicit owner approval and a scoped implementation batch
