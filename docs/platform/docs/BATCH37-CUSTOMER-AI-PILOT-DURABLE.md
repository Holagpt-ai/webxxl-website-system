# BATCH37 — Durable AI Pilot Persistence and AUTO-10 Integration

**Status:** MERGED ([PR #89](https://github.com/Holagpt-ai/webxxl-website-system/pull/89) @ `8c2e5df7f79eb7538e1fe6d513316f70026bbe6d`). **Scope:** PostgreSQL-backed pilot task + approval persistence, guarded `WORKFORCE_TASK_PREPARE` handler, optional workflow enqueue after preparation. **Not** live LLM execution, worker cron activation, or production migration apply.

## Feature flags

| Env | Default | Meaning |
|-----|---------|---------|
| `CUSTOMER_AI_PILOT_DURABLE_ENABLED` | off | Use `CustomerAiPilotTask` / `CustomerAiPilotApproval` tables |
| `CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED` | off | Enqueue AUTO-10 `WORKFORCE_TASK_PREPARE` after successful prepare |
| `CUSTOMER_AI_PILOT_HTTP_ENABLED` | off | HTTP routes (requires durable flag) |
| `WORKFLOW_ENQUEUE_ENABLED` / `WORKFLOW_DURABLE_EXECUTION_ENABLED` | off | Required for enqueue path (existing AUTO-10 gates) |

Requires `CUSTOMER_AI_WORKFORCE_ENABLED` and `CUSTOMER_AI_PILOT_PREP_ENABLED` for library preparation. Does **not** enable `CUSTOMER_AI_EXECUTION_ENABLED`.

## Migration

`prisma/migrations/20261102130000_batch37_customer_ai_pilot_persistence` — `CustomerAiPilotTask`, `CustomerAiPilotApproval`, workflow sync columns (`workflowJobId`, `workflowSyncState`, `workflowValidatedAt`). Staging apply is included in the **39/39** chain on `vcgibefnhneaqhcguhnt` ([rollout result](../../BATCH40-STAGING-ROLLOUT-RESULT.md); pending migrations applied through batch37). Production apply stays **UNVERIFIED**.

## AUTO-10 integration

After preparation (when enqueue flag on), jobs use kind `WORKFORCE_TASK_PREPARE`, `sourceType` `CustomerAiPilotTask`, idempotency `customer-ai-pilot:prepare:{taskId}`. Handler revalidates employee ACTIVE/pause/policy and tenant binding on **every** attempt (including retries after `VALIDATED`); marks task `workflowSyncState=VALIDATED` with compare-and-set from `QUEUED`/`NOT_QUEUED` only. `VALIDATED` cannot be downgraded except via explicit eligibility failure (`invalidateValidated`). Enqueue failure sets `FAILED` + `blockedReason=ENQUEUE_FAILED:*` only from `NOT_QUEUED` and returns documented recovery text on the prepare DTO (`workflowEnqueue.recovery`). No external provider calls.

## Tests

`__tests__/platform/batch37-customer-ai-pilot-durable.test.ts` — persistence lifecycle fields, enqueue gating, handler tenant validation, recovery idempotency, Prisma mapper (mocked).
