# WebXXL Agent Instructions — Mandatory

Scope: this repository and all assistant/coding-agent work on WebXXL.

## Startup

Read `README.md`, `docs/PROJECT_MEMORY.md`, `docs/SESSION_HANDOFF.md`, `docs/platform/docs/00-SESSION-START.md`, `docs/platform/docs/01-MASTER-TAD.md`, and the relevant domain file(s). When proposing a change, first verify live GitHub `main` and affected source; treat repository docs as context, not proof of deploy status.

Start with a compact status: current source SHA, active batch, known production evidence or UNVERIFIED, changed ownership surfaces, explicit exclusions. A successful Vercel production deployment records that SHA only. It does not prove migrations, flags, or provider activation.

## Binding constraints

1. Cursor owns backend, schema/Prisma/Supabase, workers, APIs, integration logic, tests, documentation/CI, Git and deployment automation. v0.app owns UI/UX for public, customer and admin experiences. No overlapping file edits.
2. Preserve existing portal screens, localization (English and Spanish), account/project memberships, deployment-specific approval, separate owner-content approval and independent DNS cutover authorization.
3. Operational tenant boundary = `CustomerAccount`. `BillingGroup` is permitted payer aggregation only, never sibling customer-data access. Do not cross business consent, CRM, provider or data scopes.
4. Existing `docs/platform/` Master TAD is canonical approved design. Operational docs here summarize/link; do not independently change TAD requirements, pricing or policy.
5. Do not invent events, analytics, AI execution, provider capabilities, approval, or deployment state. Use explicit UNKNOWN/UNVERIFIED and evidence links.
6. Never run production migrations, flags, live sends, billing, external-account connection, schedules, provisioning, public publishing or DNS cutovers without separate explicit owner authorization.
7. Do not introduce parallel worker engines, duplicate payment ownership or a replacement CRM architecture without an approved ADR and bounded proof.
8. Cursor uses large cohesive, non-overlapping implementation batches, focused tests, and owner-review PRs. Do not expand into recurring broad audits or infrastructure troubleshooting unless a release gate requires it.
9. For consequential architecture/vendor/security/commercial changes, check legacy ADR-001..017 in `docs/platform/docs/15-DECISIONS-CHANGELOG.md` and new `docs/adr/INDEX.md`; create a new PROPOSED ADR only if no existing decision covers the change. No ADR can be marked APPROVED without explicit owner approval evidence and canonical log update. Never turn a proposed ADR into implementation authorization.

## Mandatory change housekeeping

Every significant architecture PR must cite its ADR ID (or a legacy decision ID), and ordinary PRs must state when an ADR is not required. Each PR must update only impacted operational docs. Source-impact matrix: route/nav → `ROUTE_MAP`; provider/data/worker → `DATA_AND_SERVICES`; decision/scope → `PROJECT_MEMORY` and existing `docs/platform/docs/15-DECISIONS-CHANGELOG.md`; release → `DEPLOYMENT_STATUS` only after evidence; defect/defer → `ISSUE_REGISTER`; every completed batch → `CHANGELOG` and `SESSION_HANDOFF`.

End each session with one copyable handoff: exact repo, branch, SHA, PR, merged/production/flag/migration states, changed files, tests, blockers, next action, owner and prohibited actions. Do not describe unmerged code as shipped.
