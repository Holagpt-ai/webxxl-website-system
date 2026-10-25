# 00 — Mandatory Session Start & Anti-Drift Protocol

**Contract ID:** SESSION-GATE-001 · **Applies to:** all human developers, assistants, Cursor agents, v0.app tasks and future AI workers participating in WebXXL development.

## Mandatory reading sequence for every fresh work session

1. Read the root `README.md`, `AGENTS.md`, `docs/PROJECT_MEMORY.md`, and `docs/SESSION_HANDOFF.md`. Read **`01-MASTER-TAD.md`** when the batch changes architecture, policy, tenancy, or commercial scope. Do not re-read the entire TAD on an ordinary implementation batch.
2. Read **`02-CURRENT-STATE.md`**, then **`15-DECISIONS-CHANGELOG.md`**. Follow the domain specification sections that the batch actually changes.
3. Identify the actual repository, branch, code revision, relevant schema, applicable feature flags and last merged batch. The TAD is architecture; source and deployed evidence determine actual status.
4. Confirm the chosen implementation batch, exact modules and file ownership; show affected contracts, migration impact, external providers and acceptance cases.
5. Do not infer permission to deploy, charge, import PHI, send SMS, run voice calls, start ads or publish websites from documentation approval.
6. Execute in **large, coherent, non-overlapping Cursor batches**, with only focused verification necessary for safe continuation. Save extensive end-to-end/release audits for staging/production gates.
7. After each batch, update `02-CURRENT-STATE.md` (facts/evidence), `13-IMPLEMENTATION-ROADMAP.md` (status), and `15-DECISIONS-CHANGELOG.md` if decisions changed. Every plan must be updated against reality rather than copied forward as completed.
8. Preserve a fresh, copyable handoff: goal, implemented, unmerged/unreleased, known issues, changed files, commit/PR/deployment IDs, exact next step.

## Continuity layer

Ordinary Cursor sessions read root `AGENTS.md`, `docs/PROJECT_MEMORY.md`, and `docs/SESSION_HANDOFF.md` first, then this protocol and only the domain sections the batch touches. Do not re-audit the whole repository every session. This file and `01-MASTER-TAD.md` stay canonical for architecture and policy. New decision files live in `docs/adr/` starting at ADR-018. ADR-001 through ADR-017 stay in `15-DECISIONS-CHANGELOG.md` and are not renumbered.

## Authoritative priority order

1. Direct explicit owner decisions recorded in this document set.
2. Security, applicable law, contractual requirements and necessary vendor operating conditions (disclose conflicts; do not silently diminish product vision).
3. Approved TAD version and ADRs.
4. Verified current repository/deployed facts.
5. Older discussions or incomplete drafts (informational only, do not override newer signed decisions).

If two approved decisions conflict, **stop at the conflict and submit a focused change decision**. Do not silently pick a convenient interpretation. Maintain the more expansive approved outcome while researching a compliant route.

## Product continuity constraints

- Preserve customer dashboard as represented in the 2026-10-17 screenshot; **do not replace**, reset or visually redesign without scoped UI authorization.
- Preserve project/version approval invariants: immutable preview deployment-bound approval; distinct owner content review; separately authorized domain cutover.
- Preserve existing Auth.js, Prisma, PostgreSQL/Supabase, locale paths, account/project selectors, customer memberships, module registry, service marketplace and automation event pipeline.
- Preserve ABMED Clinical Research, ABMED Aesthetics and ABMED Physicians Group as independently managed operating account targets under a future shared payer/wallet; **do not mutate existing ABMED account membership/project associations in an architecture batch**.
- Preserve separate service ownership: **v0.app ALL UI/UX; Cursor backend; Vercel production app**. Hostinger/Docker only for isolated services after resources are verified.
- Preserve free CRM, free Marketing Studio (visible FREE badge), free Postiz-based social automation, free local SEO visibility, AI-generated landing pages, campaign preparation and ad creative for the approved eligible user cohort. Eligibility of non-subscribed prospects remains an explicitly open business decision.
- Preserve one group wallet, many business CRM workspaces, one group payer, channel and healthcare separation, and potential future purchaseable AI employee SKUs behind a disabled flag.

## Change-control process — no silent downgrade

Propose a change request with fields `ID`, `requestedBy`, `change`, `scope`, `reason`, `capabilities retained`, `data migration`, `licensing/compliance effects`, `cost`, `fallback without downgrade`, `acceptance delta`, `owner decision`, `date`, `TAD version`. Unapproved change stays PROPOSED. No removal/replacement/deprecation of a required capability without owner approval. A staged release may hide unfinished features only if architecture and contracts retain the complete target.

## Definition of done for a batch

- Code and schema correspond to approved contracts; no unauthorized edits.
- Focused tests pass for changed module; data migration/backfill and reversal plan recorded if applicable.
- Tenant, wallet, consent and authorization invariants covered if affected.
- New provider configuration/credential prerequisites listed; no secrets checked in.
- PR/commit, owner of changed paths and deployment status recorded honestly.
- Documentation version/status and batch report updated.

## Short mandatory startup response template

```
WebXXL architecture: TAD vX.Y.Z
Source baseline: repo/branch/SHA; production status separately confirmed or unverified
Current approved batch: <ID>
Read: README, 00, 01, 02, 15, and <domain docs>
Protected existing functions: <affected old workflows>
Work owned by Cursor: <backend paths>; v0.app: <UI paths>
New dependencies / owner actions: <list>
Deliverables and acceptance gates: <list>
No unapproved downgrade or production writes.
```
