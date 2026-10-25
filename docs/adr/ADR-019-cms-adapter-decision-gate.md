---
id: ADR-019
title: Conditional headless CMS or visual content editor adoption
status: PROPOSED
date: 2026-10-25
decision_owner: WebXXL owner
approval_evidence: NONE
source_decision: ADR-001; ADR-002; ADR-003; ADR-004; ADR-016
implementation_state: NOT_STARTED
production_state: NOT_ACTIVATED
supersedes: NONE
superseded_by: NONE
---

# ADR-019 — Conditional headless CMS or visual content editor adoption

## Context
Customer self-service content editing and approved AI website updates could reduce agency operations work. WebXXL already has version-bound website previews/approvals and a v0-owned UI. A second CMS should be considered **only if** native editing capabilities are insufficient for a concrete customer use case.

## Decision
**PROPOSED selection gate; no CMS selected.** Evaluate Payload first for Next.js compatibility, with Strapi and Directus as alternatives, alongside a smaller native editor. Any CMS is an **adapter for selected managed websites**, not a replacement for the WebXXL portal, identity, project approvals or billing.

## Options considered
| Option | Benefits | Costs/risks | Disposition |
|---|---|---|---|
| Payload CMS adapter | TypeScript/Next.js affinity; editing/versioning | Integration/DB/role model/upgrade cost | Evaluation candidate only |
| Strapi adapter | Structured CMS, APIs, i18n | Separate service, auth and schema | Alternative |
| Directus adapter | Structured content admin | Licensing, database isolation and embedding review | Alternative |
| Native bounded editor | Tight control, fewer platforms | Feature construction cost | Valid fallback |

## Consequences
A provider may reduce editor development, but adds service ownership and customer/content authorization mapping. Keep source-of-truth boundaries, approved publishing and deployment-version tracking outside specialist CMS internals.

## Compatibility and safety
No CMS deployment or UI modification. When selected, Cursor builds backend adapter/version event wiring; v0 owns editor UI. Review tenant isolation, customer credential scopes, content version conflict handling, backups/exports, provider license and rollback. Clinical content/eligibility/compensation updates need human review and must never be autonomous.

## Evidence and links
- `docs/platform/docs/01-MASTER-TAD.md`, existing site approval invariants
- `docs/platform/docs/05-SITEMAP-WIREFRAMES.md`, existing UI contract
- `docs/platform/docs/16-PROVIDER-REGISTER.md`, vendor qualification requirement
- No verified proof of a current WebXXL CMS bottleneck supplied; validate before implementation

## Approval and rollout
- Owner decision: PENDING
- Approval evidence: NONE
- Implementation: NOT_STARTED
- Production deployed: NO
- Migration applied: NO
- Activated: NO
- Verified live: NO
- Next authorized trigger: specific content-editing requirement and owner-approved candidate pilot after higher-priority work
