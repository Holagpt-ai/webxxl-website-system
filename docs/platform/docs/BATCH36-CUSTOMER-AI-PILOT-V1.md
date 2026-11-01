# BATCH36 — Customer AI Workforce Pilot V1 (preparation only)

**Status:** IN PR · **Scope:** guarded task preparation, human approval binding, three deterministic pilot workflows. **Not** live LLM execution, outbound messaging, Chatwoot bridge, or AUTO-10 dispatch.

## Feature flag

| Env | Default | Meaning |
|-----|---------|---------|
| `CUSTOMER_AI_PILOT_PREP_ENABLED` | off | Pilot task preparation APIs and in-memory task registry |

Requires `CUSTOMER_AI_WORKFORCE_ENABLED`. Does **not** enable `CUSTOMER_AI_EXECUTION_ENABLED` or outbound flags.

## Pilot workflows (deterministic)

| Kind | Tools | Outcome |
|------|-------|---------|
| `crm_lead_intelligence` | CRM read / lead qualify (draft) | `PREPARED` or `PENDING_APPROVAL` |
| `marketing_seo_assistant` | Knowledge read / workflow request (draft) | Marketing Studio–style draft; publish blocked |
| `receptionist_preparation` | Knowledge read / handoff prep | EN/ES approved FAQ scope; no live chat |

Labels: `PREPARED`, `PENDING_APPROVAL`, `BLOCKED`, `UNVERIFIED`. Drafts are **not** labeled as AI-generated.

## HTTP (v0 integration contract extension)

| Method | Path |
|--------|------|
| POST | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}/pilot-tasks/prepare` |
| POST | `/api/v1/customer-ai/accounts/{accountId}/pilot-tasks/{taskId}/approvals` |
| POST | `/api/v1/customer-ai/accounts/{accountId}/pilot-tasks/{taskId}/execution-attempt` |

Prepared tasks and approvals use an **in-process pilot task store** (Batch 36). Durable persistence is deferred; production migration not required for this batch.

## Human approval binding

Approvals bind account, site, employee, tool, immutable `actionHash`, allowed action, approver identity, expiry, and optional cost ceiling. Revoked, expired, tampered, or consumed approvals fail closed. Execution attempt route always returns `EXECUTION_DISABLED` while execution flags remain off.

## Tests

`__tests__/platform/batch36-customer-ai-pilot.test.ts` — tenant isolation, billing-group denial, grants, injection, approvals, pause, budget, idempotency, PHI, locales, runtime block.
