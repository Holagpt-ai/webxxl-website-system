# WebXXL Architecture Decision Records — Operating Policy

> **Scope:** This directory is the decision-by-decision rationale layer, not a replacement for the approved Master TAD. Existing decisions **ADR-001 through ADR-017** are already indexed in [`docs/platform/docs/15-DECISIONS-CHANGELOG.md`](../platform/docs/15-DECISIONS-CHANGELOG.md); **do not renumber, recreate or silently alter them**. New records start with **ADR-018**.

## Authority and purpose

- **Owner-approved product and policy commitments:** `docs/platform/docs/01-MASTER-TAD.md` and `docs/platform/docs/15-DECISIONS-CHANGELOG.md`.
- **New ADRs:** durable technical options, tradeoffs, rationale, planned migration, security, tests, and explicit decision evidence. A proposal is not an authorization to implement or deploy.
- **Implementation truth:** relevant code and merged PRs. **Deployment truth:** external deployment, migration, provider and environment evidence. ADR APPROVED does **not** imply implementation or activation.
- **Operational navigation:** `docs/PROJECT_MEMORY.md`, `docs/SESSION_HANDOFF.md`, and [`INDEX.md`](INDEX.md).

## When to write an ADR

Create an ADR **before** materially changing any of these:

1. Tenant isolation, authorization, consent, PHI/sensitive data boundaries, account-to-billing aggregation, or approval semantics.
2. Canonical data ownership, database technology, irreversible schema migration, or cross-system sync authority.
3. The durable execution engine, worker ownership, event transport, global queue, or scheduler.
4. A strategic vendor/provider integration **that changes topology or operating obligations**, e.g. embedded CMS, CRM platform, workflow engine, payment system, communications layer.
5. Provider lock-in, licensing obligations, recurring cost structure, canonical API contract or major public-route/SEO strategy.
6. Free vs paid policy, billing architecture, human review gates, regulated communication rules, or production release authority.
7. Superseding another accepted architectural decision.

**No ADR required** for ordinary defect fixes, additive UI polish within v0 ownership, internal refactors preserving contracts, small documentation corrections, or an implementation already explicitly authorized by an existing decision. Link the existing ADR/decision instead.

## Naming and registry

- Filename: `ADR-018-short-descriptive-slug.md`, `ADR-019-...md`, incrementing monotonically without reuse.
- Top of file: machine-readable simple YAML-style fields (`id`, `title`, `status`, `date`, `decision_owner`, `approval_evidence`, `source_decision`, `implementation_state`, `production_state`, `supersedes`, `superseded_by`). Keep values single-line and quote when necessary.
- Include all section headings in [`TEMPLATE.md`](TEMPLATE.md) and an explicit **Options considered** comparison. The selected option may be `Pending decision` for PROPOSED records.
- Add/update exactly one row in [`INDEX.md`](INDEX.md) for each new numbered record. Legacy ADR-001–017 remain linked to the existing decisions changelog, not duplicated as new files.
- Any APPROVED record must include an exact owner decision reference and update or link the `15-DECISIONS-CHANGELOG.md`; do not manufacture historical approval dates.

## State machine and approval boundary

```text
PROPOSED → APPROVED → SUPERSEDED
         ↘ REJECTED
PROPOSED → DEFERRED → PROPOSED (when revisited with owner direction)
```

- **PROPOSED:** evaluation or recommendation; not a selected vendor or approved build.
- **DEFERRED:** intentionally inactive pending milestone or dependency; no implementation implied.
- **APPROVED:** owner explicitly accepted the decision, with link/date recorded in `approval_evidence` and the canonical decision log. An owner-approved decision may still have `implementation_state: NOT_STARTED` and `production_state: NOT_ACTIVATED`.
- **REJECTED:** evaluated and declined; preserve rationale.
- **SUPERSEDED:** historical accepted decision replaced by an approved successor; never delete the original record.

For a foundational decision already present in the legacy log (e.g., ADR-004 tenancy, ADR-011 Chatwoot preference), cite its existing ID. Do **not** mint a competing ADR just to restate it.

## Decision lifecycle (owner + Cursor + v0)

1. **Raise:** Cursor or ChatGPT identifies a materially new choice and checks legacy ADR-001..017 and current source for a prior answer.
2. **Draft:** Cursor prepares one numbered PROPOSED ADR, options, technical fit, licenses, costs, tenant/security, migration/rollback, affected paths, and dependency milestone. Do not run a broad vendor exploration without an immediate design choice.
3. **Owner decision:** Owner explicitly APPROVES, REJECTS or DEFERS. Update `INDEX.md`, `15-DECISIONS-CHANGELOG.md` when approved, and TAD version if architecture/policy changes.
4. **Implement:** Cursor changes backend/services/CI; v0 handles only UI; neither edits the other's files. Reference ADR number in PR body and commit/PR report.
5. **Release:** Track MERGED, DEPLOYED, MIGRATED, ACTIVATED and VERIFIED separately, recording environment, SHA, evidence and authorized action.
6. **Revisit:** To change an APPROVED decision, write a **new** ADR that `supersedes` the old record; link both. Preserve the old historical record unchanged apart from status/cross-reference metadata.

## Controls

- `node scripts/validate-adr.mjs` validates names, IDs, required fields, headings, index coverage, reserved legacy IDs and APPROVED approval-evidence references. No third-party packages.
- `.github/workflows/adr-integrity.yml` runs this check on PRs touching ADR files, validator or agent governance. It does **not** perform build/test/deploy work or update `main`.
- ADR-related PRs that change architecture must cite the relevant ADR (or legacy decision ID). Non-material PRs mark `Not required` with a one-line rationale.
- CI validates structure and evidence *presence*, not correctness of owner approval. Human review remains required.

## Current proposals

- [ADR-018](ADR-018-selective-provider-integration-policy.md): selective integration vs platform replacement — **PROPOSED**.
- [ADR-019](ADR-019-cms-adapter-decision-gate.md): CMS/content editor selection gate — **PROPOSED**, no CMS selected.
- [ADR-020](ADR-020-optional-automation-builder-gate.md): optional automation builder vs current execution engine — **PROPOSED**, no new engine deployed.

**Immediate priority remains BATCH-15 analytics ingestion and conversion.** These proposals do not authorize integrating new providers or delaying that batch.
