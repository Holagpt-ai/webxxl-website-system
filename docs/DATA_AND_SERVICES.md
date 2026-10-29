# Data, Providers, Workers, and Flags

Specifications: [`03-DATA-MODEL`](platform/docs/03-DATA-MODEL.md), [`04-API-INTEGRATIONS`](platform/docs/04-API-INTEGRATIONS.md), [`12-INFRA-OPERATIONS`](platform/docs/12-INFRA-OPERATIONS.md), [`16-PROVIDER-REGISTER`](platform/docs/16-PROVIDER-REGISTER.md).

| Capability | In-repo entry | External system | Source state | Activation |
|---|---|---|---|---|
| Identity and tenancy | Auth.js, Prisma `CustomerAccount`, `lib/platform/account-isolation.ts` | Supabase/PostgreSQL | MERGED | Production schema level UNVERIFIED |
| Preview and review | Projects, immutable versions, owner approvals | GitHub, Vercel deployment ids | MERGED | Per-site approval is data, not a code flag |
| CRM | `lib/platform/crm/**`, `/api/v1/crm/*`, `lib/crm-ui/**`, `components/crm/**` | Twenty adapter returns not configured until flags and mapping exist. Batch 17A HTTP merged on `main`. Batch 17B/17C wires customer CRM UI to those routes (IN PR until merge) | MERGED (backend); UI IN PR | `CRM_BACKEND_ENABLED` off; external sync not inferred |
| Communications | `lib/platform/comms/**` | Chatwoot, SMS, email candidates | MERGED | No live send inferred |
| Marketing and social | `lib/platform/marketing/**`, `lib/platform/social/**` | Postiz adapter | MERGED | Publishing off until authorized |
| SEO and analytics | `lib/platform/seo/**`, `lib/platform/analytics/**` | GSC, GA4, GBP, rank vendor | MERGED | See flags below |
| Wallet and commerce | `lib/platform/wallet/**`, `lib/platform/commerce/**` | No processor selected as the system of record | MERGED | No live charge inferred |
| Workflow | `lib/platform/workflow/**`, legacy notification worker | AUTO-10 is Prisma-first; Hatchet is not provisioned | MERGED | `WORKFLOW_*` default off in the AUTO-10 contract |
| AI workforce | `lib/platform/workforce/**`, `lib/platform/customer-ai-workforce/**` | Paperclip is a candidate adapter | MERGED | Live execution not inferred |

## Analytics flags on this source tree

From `config/analytics-backend.ts` and `config/features.ts`, read on 2026-10-25:

| Flag | Source default |
|---|---|
| `features.analyticsBackend` | `false` |
| `ANALYTICS_BACKEND_ENABLED` | off |
| `ANALYTICS_INGESTION_ENABLED` | off |
| `ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED` | off |
| `ANALYTICS_PROVIDER_FETCH_ENABLED` | off |
| `ANALYTICS_GSC_LIVE_TRANSPORT_ENABLED` | off |

Production environment values were not read. Do not describe these as activated.

## CRM, Marketing, Social, and SEO flags on this source tree

Read from `config/crm-backend.ts`, `config/mkt-backend.ts`, `config/social-marketing.ts`, and `config/seo-backend.ts` on 2026-10-26. The customer UI contract is [`platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md`](platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md). Production values were not read.

| Flag | Source default |
|---|---|
| `CRM_BACKEND_ENABLED`, `CRM_IMPORT_ENABLED`, `CRM_EXPORT_ENABLED`, `CRM_EXTERNAL_SYNC_ENABLED`, `CRM_AI_ACTIONS_ENABLED` | off |
| `MKT_BACKEND_ENABLED`, `MKT_DRAFT_PREPARATION_ENABLED`, `MKT_APPROVAL_WORKFLOW_ENABLED`, `MKT_LEAD_MONITOR_ENABLED`, `MKT_AI_GENERATION_ENABLED`, `MKT_EXTERNAL_HANDOFF_ENABLED`, `MKT_AUTOMATED_EXECUTION_ENABLED` | off |
| `SOCIAL_MARKETING_ENABLED`, `POSTIZ_API_ENABLED`, `POSTIZ_LIVE_PUBLISHING_ENABLED`, `SOCIAL_AUTOMATED_APPROVAL_ENABLED` | off |
| `SEO_BACKEND_ENABLED`, `SEO_CRAWLER_ENABLED`, `SEO_GSC_API_ENABLED`, `SEO_GOOGLE_OAUTH_ENABLED`, `SEO_GA4_API_ENABLED`, `SEO_GBP_API_ENABLED`, `SEO_PLACES_API_ENABLED`, `SEO_RANK_PROVIDER_ENABLED`, `SEO_AI_EXECUTION_ENABLED` | off |

`core.crm`, `core.marketing-studio`, and `core.local-seo` stay `POLICY_UNRESOLVED` (OPEN-001) even if a backend flag is later turned on. This table does not enable any flag.

## CRM customer HTTP (Batch 17A)

Session-scoped `CustomerAccount`; gates via `requireCrmApiActor` (`CRM_BACKEND_ENABLED` + entitlement + permission).

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/crm/contacts` | `crm.read` | Optional `q`/`search`, `cursor`, `take`; response `{ contacts, nextCursor? }` |
| PATCH | `/api/v1/crm/deals/[id]/stage` | `crm.write` | Body `{ stageId }`; transactional stage history |
| PATCH | `/api/v1/crm/tasks/[id]` | `crm.write` | Task lifecycle; assignee change owner/staff only |
| GET | `/api/v1/crm/contacts/[id]/consent` | `crm.read` | Consent history + suppressions |
| POST | `/api/v1/crm/contacts/[id]/consent` | `crm.consent.manage` | Append consent; `GRANTED` requires evidence |
| POST | `/api/v1/crm/contacts/[id]/suppression` | `crm.consent.manage` | Append suppression; does not auto-clear on new consent |

UI binding contract: [`platform/docs/BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md).

Batch 15 (merged as PR #51) adds signed capture (`POST /api/v1/analytics/capture/events`), authenticated sync worker (`x-automation-worker-secret`), PostgreSQL capture rate windows, and honest provider sync states (no fabricated `COMPLETED`). Live GSC HTTP requires SEO flags plus `ANALYTICS_PROVIDER_FETCH_ENABLED`, `WORKFLOW_EXTERNAL_EFFECTS_ENABLED`, and `ANALYTICS_GSC_LIVE_TRANSPORT_ENABLED`. Those flags stay off in source. The merge does not show a production migration or a connected provider.

## Migrations in the repository

`prisma/migrations/` includes `20261021120000_analytics14_foundation`, `20261025120000_analytics15_ingestion`, and `20261025180000_analytics151_rate_limit`. A folder in Git is not an applied production migration.

## Secrets

Record secret names, environment, owner, and the time of verification. Do not record token values, query-string secrets, or customer content in this file.
