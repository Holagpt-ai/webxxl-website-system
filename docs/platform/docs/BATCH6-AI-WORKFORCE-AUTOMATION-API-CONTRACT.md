# Batch 6 — AI Workforce & Automation API contract

**Issue:** #109 · **ADR:** not required (composes AGENT-03, AI-CUSTOMER-13, Batch 36/37, and AUTO-10; no new engine, provider, or schema).

## Delta (merged vs Batch 6)

| Area | Already on `main` | Batch 6 addition |
|---|---|---|
| Internal workforce | Five roles, in-memory tasks, approvals, pause, budgets | Account summary of supervised roles; execution stays off |
| Customer AI | Employees, knowledge, tool catalog, pilot preparation | Account-scoped deterministic preparation across CRM, projects, marketing, SEO, communications, and knowledge |
| Tool registry | Central allow/deny policy | Composed bindings with truthful coverage; unknown and tier-4 tools fail closed |
| AUTO-10 | `WORKFORCE_TASK_PREPARE` handler, retry policy, idempotent jobs | Handoff visibility only. This batch does not enqueue or run the worker |
| OPEN-001 | `SUBSCRIBER_ONLY` included marketing agents | Summary keeps the paid AI employee SKU non-purchasable |

Runtime gates remain OFF. Live inference, outbound send, charges, Paperclip, workflow cron, and external effects are **not** activated.

## Routes

OPEN-001 subscriber gate: `core.crm` and `core.marketing-studio` (`requireIncludedFreeSoftwareMembershipKeys`). `customerAccountId` in the query or body must match the session account or the response is `403`. `managedSiteId` must belong to that account or the response is `404`.

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/v1/ai-workforce/execution/summary` | Read-only composition. Slices are `AVAILABLE` or `UNAVAILABLE` with `reasonCode` |
| `POST` | `/api/v1/ai-workforce/execution/preparations` | Deterministic draft. Persistence is in-memory for this process |
| `POST` | `/api/v1/ai-workforce/execution/preparations/{preparationId}/approval-issue` | **Staff only.** Issues a server approval id bound to the preparation `actionHash`, expiry, and allowed decision |
| `POST` | `/api/v1/ai-workforce/execution/preparations/{preparationId}/approval` | **Staff only.** Verifies and consumes the server approval, then binds the human decision |
| `POST` | `/api/v1/ai-workforce/execution/pause` | **Staff only.** Pauses or resumes preparation for that account |

### HTTP mutation gates

`POST` mutations return `503 EXECUTION_DISABLED` unless `CUSTOMER_AI_WORKFORCE_ENABLED` and `AI_WORKFORCE_EXECUTION_HTTP_ENABLED` are on **and** either the runtime is non-production or `CUSTOMER_AI_PILOT_DURABLE_ENABLED` is on. Orchestration state is **process-local** (`orchestrationPersistence` summary slice); it is not globally enforced on Vercel.

### Client authority

The preparation body must not include `approvalId`, `actionHash`, `channelConnected`, `dataClassification`, `serverClassification`, `actorType`, `granted`, `executionEnabled`, or `approved`. Those fields return `400 CLIENT_AUTHORITY_REJECTED`. A prompt is untrusted text and cannot approve, classify, forge connectivity, or select a sibling account. Operating-account membership alone does **not** grant approval, pause, or approval-issue authority.

### Approval integrity

1. Staff issues an approval with `approval-issue` (linked to `preparationId`, `actionHash`, `allowedDecision`, TTL).
2. Staff binds with `approval` using the issued `approvalId`, matching `actionHash`, and `decision`.
3. Forged or expired approval ids return `403 FORGED_APPROVAL` / `APPROVAL_EXPIRED`. Consumed approvals return `APPROVAL_EXHAUSTED`. Hash mismatch returns `ACTION_HASH_MISMATCH`.

### Preparation result

Draft tools return `PENDING_APPROVAL`. Read tools return `PREPARED`. Consequential approval returns `APPROVED_EFFECT_BLOCKED` or `REJECTED`. Every success sets `executionState: DISABLED`, `outbound: BLOCKED`, `moneyEffect: NONE`, `customerChargeUsd: 0`, and `externalEffectCount: 0`. CRM drafts expose `synthesis: DETERMINISTIC_TEMPLATE`; they are not verified AI output.

`workflow.state` is `NOT_QUEUED` unless enqueue flags are already on, in which case it is `ENQUEUE_WITHHELD` (`BATCH6_DOES_NOT_DISPATCH`). Retry classes are reported from the existing AUTO-10 policy. Attempts executed stay `0`.

### Coverage

Client `channelConnected` is rejected. Server resolves channel state or reports `COVERAGE_UNVERIFIED`. Verified integration may later emit `CHANNEL_CONNECTED_PREPARATION_ONLY` or `CHANNEL_DISCONNECTED` (a coverage limit, not proof that nobody was contacted). SEO drafts are `STORED_OR_UNVERIFIED`. Communications drafts are `DISPATCH_BLOCKED`.

### Isolation and ceilings

`CustomerAccount` is the operational tenant. A shared `BillingGroup` does not grant sibling AI or CRM access. `PHI` and `REGULATED_HEALTHCARE` are refused. Hard ceilings return `BUDGET_EXCEEDED` without a customer charge. Soft ceilings return `SOFT_CEILING` and still do not charge. Agents cannot pause or approve. Idempotency replay returns the same preparation; a different payload with the same key returns `IDEMPOTENCY_CONFLICT`.

### v0 Stage B handoff (Cursor does not edit these paths)

Optional AI workforce panels:

- **Paths:** `app/[locale]/dashboard/ai-employees/**` and related v0-owned components.
- **Fetch:** `GET /api/v1/ai-workforce/execution/summary`
- **UI:** render a slice only when `status === 'AVAILABLE'`; show `reasonCode` otherwise; never treat `APPROVED_EFFECT_BLOCKED` or `PENDING_APPROVAL` as sent, charged, or model-generated; keep English and Spanish.

### Runtime gates (unchanged)

`CUSTOMER_AI_EXECUTION_ENABLED`, `CUSTOMER_AI_OUTBOUND_ENABLED`, customer AI pilot flags, `WORKFLOW_EXTERNAL_EFFECTS_ENABLED`, worker cron, Paperclip, live send, and paid model calls stay off unless a later owner gate authorizes them.
