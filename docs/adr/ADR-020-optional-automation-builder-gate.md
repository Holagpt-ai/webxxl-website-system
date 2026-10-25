---
id: ADR-020
title: Optional automation-builder integration without replacing AUTO-10
status: PROPOSED
date: 2026-10-25
decision_owner: WebXXL owner
approval_evidence: NONE
source_decision: ADR-001; ADR-004; ADR-011; ADR-012
implementation_state: NOT_STARTED
production_state: NOT_ACTIVATED
supersedes: NONE
superseded_by: NONE
---

# ADR-020 — Optional automation-builder integration without replacing AUTO-10

## Context
AUTO-10 already selected Prisma/PostgreSQL durable workflow jobs, leases and outbox to serve internal business execution, with Hatchet unprovisioned. An optional automation builder such as Activepieces could later help customers manage integrations without asking WebXXL engineers to code each workflow. Its trigger UI and connector library must not create a second unsupervised authorization, billing or delivery system.

## Decision
**PROPOSED selection gate; no automation platform selected.** Preserve AUTO-10 as the authoritative WebXXL job and event execution boundary. Evaluate an optional workflow-definition/connector adapter only for approved external automations with typed, tenant-scoped gateway calls. No independent SMS delivery, payments, publishing or AI tool execution bypasses.

## Options considered
| Option | Benefits | Costs/risks | Disposition |
|---|---|---|---|
| Optional Activepieces adapter | UI/connector ecosystem for customer automations | Hosting, licensing, webhook and tenancy risk | Evaluation candidate |
| WebXXL native limited automation builder | Full API/policy control | Requires UI and connector development | Valid fallback |
| Replace AUTO-10 with new engine | Potential advanced primitives | Competing scheduler, migration/retry double-effects | Not proposed |
| Defer customer builder | Focus on core delivery | No self-service workflows yet | Default until owner-approved pilot |

## Consequences
Can provide customer automation authoring later while preserving WebXXL billing, wallet reservations, consent and job evidence. Adds vendor and governance cost; do not enable independently during Batch 15.

## Compatibility and safety
No DB migration, service deployment or flags authorized. For a pilot, Cursor owns typed service bridge and safe webhooks; v0 owns authoring UI. Validate account binding, event idempotency, action allowlists, consent, quota, secrets access, hosted embedding license, and kill switch. Postiz remains social scheduler and COMMS remains the outbound policy gateway.

## Evidence and links
- [`AUTO10-PROVIDER-DECISION.md`](../platform/docs/AUTO10-PROVIDER-DECISION.md) — Prisma-first rationale
- `docs/platform/docs/16-PROVIDER-REGISTER.md` — Activepieces/Hatchet candidate states
- `lib/platform/workflow` — source path to verify when implementing

## Approval and rollout
- Owner decision: PENDING
- Approval evidence: NONE
- Implementation: NOT_STARTED
- Production deployed: NO
- Migration applied: NO
- Activated: NO
- Verified live: NO
- Next authorized trigger: a specific customer automation need and owner-approved scoped pilot
