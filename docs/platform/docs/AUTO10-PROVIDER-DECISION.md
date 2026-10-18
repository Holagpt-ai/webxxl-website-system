# AUTO-10 — Workflow provider decision (Prisma-first)

## Recommendation

**Use PostgreSQL + Prisma (`PrismaWorkflowProvider`) for AUTO-10.** Do not provision Hatchet or Redis in this batch.

## Comparison (concise)

| Criterion | Prisma + PostgreSQL | Hatchet (future) |
|-----------|---------------------|------------------|
| Durable execution | Row-level leases, outbox, FSM in DB | Managed engine |
| Concurrency | `FOR UPDATE SKIP LOCKED`, fencing tokens | Built-in |
| Workload scale | Sufficient for hundreds of accounts / low thousands of jobs/day | Better at very high fan-out |
| Retry guarantees | App-defined policies + persisted attempts | Engine policies |
| Infrastructure cost | $0 incremental (existing Postgres) | Additional service + ops |
| Deployment complexity | Migration + worker route | New cluster/auth/network |
| Existing worker compatibility | Extends `AutomationDeliveryJob` claims | Parallel system risk |
| Provider lock-in | None (SQL primitives) | Hatchet API coupling |
| Operational ownership | Same as WebXXL DB backups/monitoring | Split ownership |

## Blocking requirement for Hatchet

None identified for AUTO-10. Notification worker, comms receipt processing, marketing evaluation, and SEO preparation are all **short, idempotent, Postgres-coordinated** tasks.

## Adapter seam

`HatchetWorkflowProvider` remains a typed stub implementing `WorkflowProvider` — not wired in production.

## Limitations (honest)

- PostgreSQL claim concurrency is implemented in SQL but **not verified** in CI without a test database.
- Fairness is **best-effort** per-account caps at claim time, not a full distributed scheduler.

## Activation checklist (future)

1. Apply `20261018280000_auto10_workflow_foundation` migration.
2. Enable `WORKFLOW_BACKEND_ENABLED`, then enqueue/worker/read flags independently.
3. Configure `AUTOMATION_WORKER_SECRET` and workflow worker cron (owner-approved).
4. Never enable `WORKFLOW_EXTERNAL_EFFECTS_ENABLED` until domain owners sign off per handler.
