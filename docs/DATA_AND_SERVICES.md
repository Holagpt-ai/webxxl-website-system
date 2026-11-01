# Data, Providers, Workers, and Flags

Specifications: [`03-DATA-MODEL`](platform/docs/03-DATA-MODEL.md), [`04-API-INTEGRATIONS`](platform/docs/04-API-INTEGRATIONS.md), [`12-INFRA-OPERATIONS`](platform/docs/12-INFRA-OPERATIONS.md), [`16-PROVIDER-REGISTER`](platform/docs/16-PROVIDER-REGISTER.md).

| Capability | In-repo entry | External system | Source state | Activation |
|---|---|---|---|---|
| Identity and tenancy | Auth.js, Prisma `CustomerAccount`, `lib/platform/account-isolation.ts` | Supabase/PostgreSQL | MERGED | Production schema level UNVERIFIED |
| Preview and review | Projects, immutable versions, owner approvals | GitHub, Vercel deployment ids | MERGED | Per-site approval is data, not a code flag |
| CRM | `lib/platform/crm/**`, `/api/v1/crm/*`, `lib/crm-ui/**`, `components/crm/**` | Twenty adapter returns not configured until flags and mapping exist. Batch 17A HTTP and 17B/17C UI merged on `main` | MERGED | `CRM_BACKEND_ENABLED` off; external sync not inferred |
| Communications | `lib/platform/comms/**`, `lib/comms-ui/**`, `components/communications/**` | Chatwoot mapping read APIs + customer inbox UI (Batch 20C) | MERGED 20A backend + 20C UI integration (PR #62) | No live send; nav ≠ activation; transcript not exposed |
| Marketing and social | `lib/platform/marketing/**`, `lib/marketing-studio-ui/**`, `components/marketing-studio/**`, `/api/v1/marketing/*`, `/api/v1/social/*` | Postiz adapter. Batch 18A list APIs + Batch 18B/18C Marketing Studio UI merged (PR #58) | MERGED | Publishing off until authorized |
| SEO and analytics | `lib/platform/seo/**`, `lib/platform/analytics/**`, `lib/local-seo-ui/**`, `components/local-seo/**` | GSC, GA4, GBP, rank vendor | MERGED 19A backend + 19B+19C Local SEO UI (PR #60) | See flags below |
| Wallet and commerce | `lib/platform/wallet/**`, `lib/platform/commerce/**` | No processor selected as the system of record | MERGED | No live charge inferred |
| Workflow | `lib/platform/workflow/**`, legacy notification worker | AUTO-10 is Prisma-first; Hatchet is not provisioned | MERGED | `WORKFLOW_*` default off in the AUTO-10 contract |
| AI workforce | `lib/platform/workforce/**`, `lib/platform/customer-ai-workforce/**` | Paperclip is a candidate adapter | MERGED | Live execution not inferred |
| Business command center overview | `lib/platform/business-overview/**`, `GET /api/v1/business/overview` | Aggregates existing CRM/MKT/SEO/comms/project read paths | MERGED 27A/27A.2 on `main` @ `ccbca6b` | Read-only; per-module flags and OPEN-001 gates preserved |
| Business command center UI | `app/[locale]/dashboard/business/**`, `components/business/**`, `lib/business-ui/**` | Client overview via session-scoped API | MERGED Batch 27C @ `828ac12` | — |
| Managed-site lead intake | `lib/platform/site-leads/**`, `/api/v1/site-leads/**` | Signed site intake + CRM qualification inbox + funnel report | MERGED 28A–30A.1 @ `cb8d785` | `SITE_LEAD_INTAKE_ENABLED` default OFF; migrations in Git only |
| Managed-site form connector | `lib/platform/site-leads/connector/**` | Server-side HMAC submit to intake | MERGED 29A/29A.1 @ `3905994` | No customer site wiring |
| Lead funnel reporting (30A) | `lib/platform/site-leads/funnel-*`, `GET /api/v1/site-leads/funnel-report`, CRM slice in business overview | Read-only `ManagedSiteLead` aggregates | MERGED Batch 30A @ `cb8d785` | Reporting does not require intake activation |
| Lead funnel dashboard UI (30C) | `components/crm/lead-funnel-*`, `lib/crm-ui/lead-funnel.ts`, `/dashboard/crm/leads/funnel` | Customer CRM funnel charts wired to 30A API | MERGED Batch 30C @ `3a7d011` | UI only; not production acceptance |
| Controlled staging / pilot readiness (31) | `lib/platform/pilot/*`, `scripts/migration-rehearsal.ts`, `scripts/synthetic-customer-pilot-report.ts` | Migration matrix, staging assess, synthetic workflow | MERGED Batch 31 + 31.1 @ `93e3010` | No staging DB provisioned |
| Commerce wallet fulfillment integrity (32) | `lib/platform/commerce/reconciliation-report.ts`, `lib/platform/commerce/financial-boundaries.ts`, admin reconciliation route | Bounded reconciliation read model; no live checkout | MERGED Batch 32 @ `b8e58df` | Corrective wallet/commerce mutations remain gated |
| Google SEO/analytics connection readiness (33) | `lib/platform/google/*`, `/api/v1/seo/sites/*/google/readiness`, `/api/v1/analytics/accounts/*/google/readiness` | GSC/GA4/GBP stored connection assess; reuses `SiteAnalyticsConnection` | IN PR Batch 33 | `GOOGLE_PROVIDER_READINESS_ENABLED` default OFF; no live OAuth |

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

OPEN-001 **RESOLVED** (**SUBSCRIBER_ONLY** on `main` @ `c6d122` via `lib/platform/open001/`). Module APIs require qualifying website subscription evidence per `CustomerAccount` even when backend flags are on. **`ALL_SIGNUPS`** / **`HYBRID`** remain inactive future options. This table does not enable any flag.

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

## CRM data operations (Batch 23)

Services: `lib/platform/crm/import-analysis.ts`, `import-export-service.ts`, `export-pagination.ts`, `segment-engine.ts`, `segment-service.ts`, `dedup-service.ts`. Flags unchanged (`CRM_IMPORT_ENABLED`, `CRM_EXPORT_ENABLED` default off).

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/api/v1/crm/imports/preview` | `crm.import` | Row-level dispositions, in-file/existing duplicate detection, normalized preview rows |
| POST | `/api/v1/crm/imports/commit` | `crm.import` | Idempotent commit; returns `{ committed, skipped, rejected, duplicates, jobId }`; no consent grants |
| POST | `/api/v1/crm/exports` | `crm.export` | Stable ascending `id` cursor pages; CSV formula escape preserved |
| GET | `/api/v1/crm/segments/[id]` | `crm.read` | Evaluate saved segment; matched + account summaries |
| PATCH | `/api/v1/crm/segments/[id]` | `crm.admin` | Update name/filter |
| DELETE | `/api/v1/crm/segments/[id]` | `crm.admin` | Delete segment + members |
| GET | `/api/v1/crm/merge-proposals` | `crm.read` | List pending merge proposals |
| POST | `/api/v1/crm/merge-proposals` | `crm.admin` | Create merge proposal |
| POST | `/api/v1/crm/merge-proposals/[id]` | `crm.admin` | Body `{ action: "approve" \| "reject" }`; account-scoped merge audit |

## Marketing customer HTTP (MKT-08 + Batch 18A)

Session-scoped `CustomerAccount`; gates via `requireMktApiActor` (`MKT_BACKEND_ENABLED` + entitlement + permission).

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/marketing/artifacts` | `marketing.read` | Account-wide list; optional filters; cursor pagination; list omits `payload` |
| GET | `/api/v1/marketing/reviews` | `marketing.read` | Approval inbox; `effectiveStatus` and `allowedActions`; cursor pagination |
| GET | `/api/v1/marketing/requests/[id]/artifacts` | `marketing.read` | Request-scoped list (unchanged) |
| GET | `/api/v1/marketing/artifacts/[id]` | `marketing.read` | Detail + revisions (unchanged) |
| POST | `/api/v1/marketing/artifacts/[id]/submit-review` | `marketing.artifact.review` | Requires `MKT_APPROVAL_WORKFLOW_ENABLED`; atomic with artifact status |
| POST | `/api/v1/marketing/reviews/[id]/decide` | `marketing.artifact.review` | Human-only; transactional CAS |

UI binding contract: [`platform/docs/BATCH18B-MARKETING-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH18B-MARKETING-UI-INTEGRATION-CONTRACT.md).

## SEO customer HTTP (SEO-07 + Batch 19A)

Session-scoped `CustomerAccount`; gates via `requireSeoApiActor` (`SEO_BACKEND_ENABLED` + entitlement + permission). Stored reads only — no live Google on GET.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/v1/seo/sites/[siteId]/overview` | `seo.read` | `SeoSiteOverviewDto`; GSC section from `loadGscStoredSiteBundle` + `buildGscPerformanceFromObservations` |
| GET | `/api/v1/seo/sites/[siteId]/performance` | `seo.read` | `{ gsc, limitations }` aggregate |
| GET | `/api/v1/seo/sites/[siteId]/keywords` | `seo.read` | Per-query stored rows; cursor + search; shared GSC context |
| GET | `/api/v1/seo/sites/[siteId]/opportunities` | `seo.read` | Cursor pagination; optional state/severity/confidence filters |
| GET | `/api/v1/seo/sites/[siteId]/google/readiness` | `seo.read` | Batch 33 stored GSC/GA4/GBP readiness (`GOOGLE_PROVIDER_READINESS_ENABLED`) |
| POST | `/api/v1/seo/sites/[siteId]/google/readiness/assess` | `seo.read` | Bounded readiness operation; `Idempotency-Key`; no live Google fetch |

Shared loader: `lib/platform/seo/gsc-site-read.ts` (connection + latest matching `SeoSnapshot` + keyword window). Marketing create validates `seoOpportunityId` against account and site in `request-service.ts`.

UI binding contract: [`platform/docs/BATCH19B-LOCAL-SEO-UI-INTEGRATION-CONTRACT.md`](platform/docs/BATCH19B-LOCAL-SEO-UI-INTEGRATION-CONTRACT.md).

Batch 15 (merged as PR #51) adds signed capture (`POST /api/v1/analytics/capture/events`), authenticated sync worker (`x-automation-worker-secret`), PostgreSQL capture rate windows, and honest provider sync states (no fabricated `COMPLETED`). Live GSC HTTP requires SEO flags plus `ANALYTICS_PROVIDER_FETCH_ENABLED`, `WORKFLOW_EXTERNAL_EFFECTS_ENABLED`, and `ANALYTICS_GSC_LIVE_TRANSPORT_ENABLED`. Those flags stay off in source. The merge does not show a production migration or a connected provider.

## Migrations in the repository

`prisma/migrations/` includes `20261021120000_analytics14_foundation`, `20261025120000_analytics15_ingestion`, and `20261025180000_analytics151_rate_limit`. A folder in Git is not an applied production migration.

## Secrets

Record secret names, environment, owner, and the time of verification. Do not record token values, query-string secrets, or customer content in this file.
