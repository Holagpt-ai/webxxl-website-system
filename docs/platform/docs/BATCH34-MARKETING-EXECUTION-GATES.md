# Batch 34 — Marketing Studio Execution Gates V1

**Status:** IN PR (Cursor) · **ADR:** not required (extends SOCIAL-04 / MKT-08 gated workflows)

## Scope

- Guarded scheduling intent prep (`prepareGuardedSchedulingIntent`) without Postiz dispatch when `POSTIZ_LIVE_PUBLISHING_ENABLED` is false.
- Shared scheduling authorization gates (`scheduling-authorization.ts`) for approval identity, tenant channel mapping, Postiz allowlist, and quota.
- Provider readiness GET `/api/v1/social/provider-readiness` when `SOCIAL_EXECUTION_GATES_ENABLED` is true.
- Publication reconcile policy: never treat `QUEUE` as `PUBLISHED`; require release URL for published state.
- Marketing ↔ social execution gate for approved `SOCIAL_*` marketing requests.
- Schedule HTTP route returns **202 DISPATCH_BLOCKED** when execution gates are on and live publishing remains off.

## Flags (default OFF)

| Flag | Purpose |
|---|---|
| `SOCIAL_EXECUTION_GATES_ENABLED` | Module + readiness HTTP + guarded prep + reconcile boundary |
| `POSTIZ_LIVE_PUBLISHING_ENABLED` | Real provider schedule dispatch (unchanged — stays OFF) |
| `POSTIZ_API_ENABLED` | Postiz Public API calls (unchanged — stays OFF) |

## Explicit exclusions

No migrations, no v0 UI, no second scheduler, no live publishing, no provider provisioning.
