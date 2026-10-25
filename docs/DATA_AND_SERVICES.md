# Data, Providers, Workers, and Flags

Specifications: [`03-DATA-MODEL`](platform/docs/03-DATA-MODEL.md), [`04-API-INTEGRATIONS`](platform/docs/04-API-INTEGRATIONS.md), [`12-INFRA-OPERATIONS`](platform/docs/12-INFRA-OPERATIONS.md), [`16-PROVIDER-REGISTER`](platform/docs/16-PROVIDER-REGISTER.md).

| Capability | In-repo entry | External system | Source state | Activation |
|---|---|---|---|---|
| Identity and tenancy | Auth.js, Prisma `CustomerAccount`, `lib/platform/account-isolation.ts` | Supabase/PostgreSQL | MERGED | Production schema level UNVERIFIED |
| Preview and review | Projects, immutable versions, owner approvals | GitHub, Vercel deployment ids | MERGED | Per-site approval is data, not a code flag |
| CRM | `lib/platform/crm/**` | Twenty adapter returns not configured until flags and mapping exist | MERGED | External sync not inferred |
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

Production environment values were not read. Do not describe these as activated.

`lib/platform/analytics/ingestion/sync-intent.ts` and `idempotent-metric-upsert.ts` are gated helpers shipped with ANALYTICS-14. Batch 15 is the planned ingestion and conversion pipeline. It is not a second engine and it is not started as its own merged batch.

## Migrations in the repository

`prisma/migrations/` contains 33 folders, including `20261021120000_analytics14_foundation`. A folder in Git is not an applied production migration.

## Secrets

Record secret names, environment, owner, and the time of verification. Do not record token values, query-string secrets, or customer content in this file.
