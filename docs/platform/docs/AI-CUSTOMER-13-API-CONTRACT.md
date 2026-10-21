# AI-CUSTOMER-13 — Customer AI Workforce API Contract (v0)

**Audience:** v0.app customer AI Employees dashboard. **All execution and outbound flags default off.**

## Authentication

Routes require Auth.js session (`requireUser`). Access is granted only via **operating membership on the path `accountId`**, or staff/admin role. Shared billing-group membership **does not** grant access to sibling accounts.

## Global disabled state

When `CUSTOMER_AI_WORKFORCE_ENABLED` is not set:

```json
{ "code": "AI_WORKFORCE_DISABLED", "message": "Customer AI workforce backend is disabled" }
```

HTTP **503**.

## Feature flags (read-only on usage policy)

| Env | Default | Meaning |
|-----|---------|---------|
| `CUSTOMER_AI_WORKFORCE_ENABLED` | off | APIs + persistence |
| `CUSTOMER_AI_EXECUTION_ENABLED` | off | Tool/LLM execution gateway |
| `CUSTOMER_AI_OUTBOUND_ENABLED` | off | Live outbound messaging |
| `CUSTOMER_AI_CHATWOOT_ADAPTER_ENABLED` | off | Chatwoot bridge (does not send) |

## Pagination

Same as COMMERCE-12: `take` (default 25, max 100), `skip`, envelope `{ items, pagination }`.

## Employees

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/customer-ai/accounts/{accountId}/employees` | List employees |
| POST | `/api/v1/customer-ai/accounts/{accountId}/employees` | Create DRAFT employee |
| GET | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}` | Detail |
| PATCH | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}` | Update config/locales/pause |
| POST | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}/lifecycle` | Body `{ "status": "ACTIVE" \| ... }` |

Lifecycle: `DRAFT`, `INACTIVE`, `ACTIVE`, `PAUSED`, `ARCHIVED`.

`ACTIVE` requires entitlement `future.ai-employee` (active `CustomerService`) **or** staff operator, and `maxActiveEmployees` policy headroom.

## Knowledge

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/customer-ai/accounts/{accountId}/knowledge` | List items |
| POST | `/api/v1/customer-ai/accounts/{accountId}/knowledge` | Create/update draft + revision |
| POST | `/api/v1/customer-ai/accounts/{accountId}/knowledge/{knowledgeId}/approve` | Approve + publish |
| GET | `/api/v1/customer-ai/accounts/{accountId}/knowledge-retrieval?locale=en&employeeId=` | Safe retrieval contract (`executionEnabled: false`) |

Statuses: `DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `ARCHIVED`.

## Tool permissions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}/tool-permissions` | Catalog + grants |
| PUT | `/api/v1/customer-ai/accounts/{accountId}/employees/{employeeId}/tool-permissions` | Body `{ toolKey, accessMode: "READ"\|"WRITE", granted }` |

Deny-by-default. Forbidden tools (e.g. `customerAi.clinical.readPhi`, `customerAi.messages.sendLive`) return `POLICY_BLOCKED` when grant attempted.

## Conversations & handoffs

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/customer-ai/accounts/{accountId}/conversations` | List / create session |
| GET | `/api/v1/customer-ai/accounts/{accountId}/conversations/{sessionId}` | Detail + handoffs |
| POST | `/api/v1/customer-ai/accounts/{accountId}/conversations/{sessionId}/messages` | Idempotent ingest `{ idempotencyKey, role, bodyText }` |
| POST | `/api/v1/customer-ai/accounts/{accountId}/conversations/{sessionId}/handoffs` | Request human handoff |

Optional future link: `chatwootConversationMappingId` on session (COMMS-06 mapping), adapter disabled by default.

## Usage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/customer-ai/accounts/{accountId}/usage-policy` | Limits + flags + active count |
| GET | `/api/v1/customer-ai/accounts/{accountId}/usage-summary` | Per-employee counters (UTC month) |

## Error codes

`AI_WORKFORCE_DISABLED`, `UNAUTHORIZED`, `FORBIDDEN`, `TENANT_MISMATCH`, `VALIDATION`, `ENTITLEMENT_UNRESOLVED`, `EXECUTION_DISABLED`, `NOT_FOUND`, `INVALID_TRANSITION`, `POLICY_BLOCKED`, `EMERGENCY_DISABLED`.
