# Batch 16A — Customer Business Workspace Integration Contract

**Status:** contract only. No UI, no migration, no flag change, no provider activation.  
**Baseline:** GitHub `main` `2b7ec7be2aeadccfb595a2ab7edf59b775876efe` (PR #52).  
**Date:** 2026-10-26. **Owner of this document:** Cursor. **UI owner for the next stage:** v0.app.  
**ADR:** not required. This applies ADR-003 (v0.app owns UI/UX; Cursor owns backend) and reconciles the proposed sitemap in [`05-SITEMAP-WIREFRAMES.md`](05-SITEMAP-WIREFRAMES.md). It does not change pricing, tenancy, vendors, or approval policy.

A source route below is a binding contract for UI work. A flag-disabled or `POLICY_UNRESOLVED` route is not production-ready. The UI must render the unavailable state from the response. It must not invent contacts, campaigns, Google metrics, or rankings.

## 1. Locked customer routes

Locales stay as they are: English is unprefixed (`/dashboard/...`) and Spanish is `/es/dashboard/...`. Page files live under `app/[locale]/dashboard/`. The dashboard layout already authenticates and renders `components/dashboard/shell.tsx`. New pages must render inside that shell. They must not replace it.

The proposed sitemap’s separate `/dashboard/social` and `/dashboard/communications` trees are not part of this batch. Social reads and handoffs sit inside Marketing Studio. Project messages stay on `/dashboard/messages`. Global approvals stay on `/dashboard/approvals`. Billing stays on `/dashboard/billing`. Analytics stays on `/dashboard/analytics`.

There is no CRM leads page. Deals are the opportunity list. There is no customer HTTP API for a leads collection.

### CRM — `/dashboard/crm`

| Screen | Path | Page file |
|---|---|---|
| CRM overview | `/dashboard/crm` | `app/[locale]/dashboard/crm/page.tsx` |
| Contacts | `/dashboard/crm/contacts` | `app/[locale]/dashboard/crm/contacts/page.tsx` |
| Contact 360 | `/dashboard/crm/contacts/[contactId]` | `app/[locale]/dashboard/crm/contacts/[contactId]/page.tsx` |
| Companies | `/dashboard/crm/companies` | `app/[locale]/dashboard/crm/companies/page.tsx` |
| Pipelines and deals | `/dashboard/crm/pipeline` | `app/[locale]/dashboard/crm/pipeline/page.tsx` |
| Tasks | `/dashboard/crm/tasks` | `app/[locale]/dashboard/crm/tasks/page.tsx` |
| Segments | `/dashboard/crm/segments` | `app/[locale]/dashboard/crm/segments/page.tsx` |
| Import and export | `/dashboard/crm/import` | `app/[locale]/dashboard/crm/import/page.tsx` |
| Settings (honest gaps) | `/dashboard/crm/settings` | `app/[locale]/dashboard/crm/settings/page.tsx` |

### Marketing Studio — `/dashboard/marketing`

| Screen | Path | Page file |
|---|---|---|
| Marketing overview | `/dashboard/marketing` | `app/[locale]/dashboard/marketing/page.tsx` |
| Requests | `/dashboard/marketing/requests` | `app/[locale]/dashboard/marketing/requests/page.tsx` |
| Request detail | `/dashboard/marketing/requests/[requestId]` | `app/[locale]/dashboard/marketing/requests/[requestId]/page.tsx` |
| Deliverables | `/dashboard/marketing/deliverables` | `app/[locale]/dashboard/marketing/deliverables/page.tsx` |
| Deliverable detail | `/dashboard/marketing/deliverables/[artifactId]` | `app/[locale]/dashboard/marketing/deliverables/[artifactId]/page.tsx` |
| Campaigns and social handoffs | `/dashboard/marketing/campaigns` | `app/[locale]/dashboard/marketing/campaigns/page.tsx` |
| Campaign detail | `/dashboard/marketing/campaigns/[campaignId]` | `app/[locale]/dashboard/marketing/campaigns/[campaignId]/page.tsx` |
| Approvals | `/dashboard/marketing/approvals` | `app/[locale]/dashboard/marketing/approvals/page.tsx` |
| Scheduling and publication status | `/dashboard/marketing/schedule` | `app/[locale]/dashboard/marketing/schedule/page.tsx` |
| Social connections | `/dashboard/marketing/connections` | `app/[locale]/dashboard/marketing/connections/page.tsx` |

### Local SEO — `/dashboard/seo`

| Screen | Path | Page file |
|---|---|---|
| SEO overview | `/dashboard/seo` | `app/[locale]/dashboard/seo/page.tsx` |
| Sites and pages | `/dashboard/seo/pages` | `app/[locale]/dashboard/seo/pages/page.tsx` |
| Search performance | `/dashboard/seo/keywords` | `app/[locale]/dashboard/seo/keywords/page.tsx` |
| Local markets and competitors | `/dashboard/seo/local-market` | `app/[locale]/dashboard/seo/local-market/page.tsx` |
| Opportunities | `/dashboard/seo/opportunities` | `app/[locale]/dashboard/seo/opportunities/page.tsx` |
| Provider connections | `/dashboard/seo/connections` | `app/[locale]/dashboard/seo/connections/page.tsx` |

Findings and scan preparation are actions and secondary reads on the pages and connections screens. They are not extra routes.

## 2. How to read capability class

| Class | Meaning in this contract |
|---|---|
| IMPLEMENTED | The HTTP handler and the JSON keys below exist in source and can be bound by the UI. |
| PARTIAL | A handler exists, and the screen’s sitemap behavior is only partly covered. |
| DISABLED | The source handler exists, and the default gate rejects the call. Bind the disabled state. Do not describe the API as live. |
| NOT IMPLEMENTED | No customer HTTP contract exists for that behavior. |
| DEFERRED | Needs a separate owner or vendor authorization. Do not build a live control for it. |

Every CRM, Marketing, Social, and SEO customer route in this document is **DISABLED at the current source defaults**, even when the row also says the handler is IMPLEMENTED. `core.crm`, `core.marketing-studio`, and `core.local-seo` evaluate to `POLICY_UNRESOLVED` because OPEN-001 is unresolved (`lib/platform/entitlements.ts`). Turning a backend flag on does not by itself make the route usable for CRM, Marketing, or SEO.

## 3. Shared gates, scope, and errors

Account scope is the active `CustomerAccount` from `requireCustomerMembership()` (`lib/portal/authz.ts`). The membership cookie is a preference. It is not a way to address another account. `BillingGroup` is not an authorization input on these routes. A client-supplied account id must not be trusted. `POST /api/v1/crm/exports` rejects `targetAccountId` when it differs from the actor account (`403 FORBIDDEN`).

Dashboard pages are already behind `app/[locale]/dashboard/layout.tsx`, which redirects a missing session to `/login` or `/es/login`. Direct API calls are different: CRM, Marketing, and SEO handlers do not catch `AuthError`. A missing session on those APIs is not a stable `{ code, message }` body. Social list handlers map a non-`SocialApiError` to `401` `{ code: "UNAUTHORIZED", message: "Unauthorized" }`. The UI should run inside the dashboard session and still treat a non-JSON body as an error.

Error bodies that these handlers do return use `{ code, message }` unless a success body is specified below.

### Backend flags (source default off)

| Flag | Reader | Effect on the customer API |
|---|---|---|
| `CRM_BACKEND_ENABLED` | `isCrmBackendEnabled()` | Off returns `503` `CRM_DISABLED` before data. |
| `CRM_IMPORT_ENABLED` | import preview and commit | Off returns `403` `FORBIDDEN`, message `CRM import disabled`, after the backend gate passes. |
| `CRM_EXPORT_ENABLED` | export | Off returns `403` `FORBIDDEN`, message `CRM export disabled`, after the backend gate passes. |
| `CRM_EXTERNAL_SYNC_ENABLED` | no customer settings route | No sync UI. |
| `CRM_AI_ACTIONS_ENABLED` | no customer route | No AI CRM action. |
| `MKT_BACKEND_ENABLED` | `isMktBackendEnabled()` | Off returns `503` `MKT_DISABLED`. |
| `MKT_DRAFT_PREPARATION_ENABLED` | create request, prepare, revision | Off returns `503` `NOT_CONFIGURED`. |
| `MKT_APPROVAL_WORKFLOW_ENABLED` | submit review, decide | Off returns `503` `NOT_CONFIGURED`. |
| `MKT_LEAD_MONITOR_ENABLED` | follow-up evaluate | Off returns `503` `NOT_CONFIGURED`. List of stored evaluations still depends on `MKT_BACKEND_ENABLED` only. |
| `MKT_AI_GENERATION_ENABLED` | not a customer generation route | Drafts that exist are deterministic (`generationMode: DETERMINISTIC_DRAFT`). |
| `MKT_EXTERNAL_HANDOFF_ENABLED` | no customer HTTP route | Social handoff service stays blocked. |
| `MKT_AUTOMATED_EXECUTION_ENABLED` | no customer execute route | No automated send or publish from Marketing Studio. |
| `SOCIAL_MARKETING_ENABLED` | `requireSocialApiActor()` | Off returns **`403`** `SOCIAL_MARKETING_DISABLED` (not 503). |
| `POSTIZ_API_ENABLED` | provider adapter | No customer connect or publish route turns this on. |
| `POSTIZ_LIVE_PUBLISHING_ENABLED` | `POST .../schedule` | Off returns `503` `NOT_CONFIGURED`. On still returns `501` `PENDING_PILOT`. |
| `SOCIAL_AUTOMATED_APPROVAL_ENABLED` | domain approval service | The customer approve route does not perform approval. |
| `SEO_BACKEND_ENABLED` | `isSeoBackendEnabled()` | Off returns `503` `SEO_DISABLED`. |
| `SEO_CRAWLER_ENABLED` | scan prepare | Off still returns **`202`** with `status: "BLOCKED"`. That is not a completed crawl. |
| `SEO_GSC_API_ENABLED`, `SEO_GOOGLE_OAUTH_ENABLED`, `SEO_GA4_API_ENABLED`, `SEO_GBP_API_ENABLED`, `SEO_PLACES_API_ENABLED`, `SEO_RANK_PROVIDER_ENABLED` | provider adapters | No customer OAuth or live-fetch route. |
| `SEO_AI_EXECUTION_ENABLED` | no customer execute route | Opportunities are stored recommendations, not executed changes. |

Entitlement keys and the OPEN-001 result:

| API family | Entitlement | Default access when the backend flag is on |
|---|---|---|
| CRM | `core.crm` | `503` `POLICY_UNRESOLVED` |
| Marketing | `core.marketing-studio` | `503` `POLICY_UNRESOLVED` |
| SEO | `core.local-seo` | `503` `POLICY_UNRESOLVED` |
| Social | not checked on read routes | Flag off is `403` `SOCIAL_MARKETING_DISABLED`. Create checks `core.marketing-studio` only for a missing or `DISABLED` entitlement. It does not return `POLICY_UNRESOLVED`. The UI must still treat social as unavailable while the flag is off. `core.social-automation` is not consulted by these routes. |

### Membership permissions

Staff short-circuits the `*.admin` permission only. Customer roles:

| Permission | OWNER | MEMBER |
|---|---|---|
| `crm.read`, `crm.write` | yes | yes |
| `crm.import`, `crm.export`, `crm.consent.manage`, `crm.admin` | yes | no |
| `marketing.read`, `marketing.request.create`, `marketing.artifact.prepare`, `marketing.followup.read`, `marketing.followup.manage` | yes | yes |
| `marketing.artifact.review`, `marketing.brand.manage`, `marketing.admin` | yes | no |
| `seo.read`, `seo.scan.prepare`, `seo.market.manage`, `seo.opportunity.manage` | yes | yes |
| `seo.configure`, `seo.admin` | yes | no |

Social routes do not check a `social.*` permission. They require a customer membership after the flag check. `managedSiteId` on the social actor is always `undefined` (`lib/platform/social/route-auth.ts`). A site selector on campaign create is not enforced by that API.

There is no customer HTTP route for `crm.consent.manage` or `seo.configure`.

### Frontend data-access boundary

Follow `app/[locale]/dashboard/analytics/page.tsx` and `lib/analytics-ui/client.ts` as the pattern, without editing those files.

1. The page is a server component. It uses `getPageContext`, relies on the dashboard layout for membership, and for Marketing and SEO loads sites with `listManagedSitesForAccount` from `@/lib/managed-sites/queries`. Do not use `GET /api/v1/seo/sites` as the only site selector. That route is behind `SEO_BACKEND_ENABLED` and returns `503` while the flag is off. The selector must still render.
2. Pass `accountId`, sites (`id`, `name`, `domain`), `locale`, and copy into a client view. Do not pass a `BillingGroup` id. Do not let the client choose an account id.
3. Browser calls go through new client modules that v0 owns (`lib/crm-ui`, `lib/marketing-studio-ui`, `lib/local-seo-ui`). Use same-origin `fetch` to the paths in this contract. Type only the JSON keys named here.
4. Do not import `@/lib/platform/**` from those client modules. Platform modules are server contracts and stay Cursor-owned.
5. Map gate codes to a disabled panel: `CRM_DISABLED`, `MKT_DISABLED`, `SEO_DISABLED`, `SOCIAL_MARKETING_DISABLED`, `POLICY_UNRESOLVED`, `NOT_CONFIGURED`. Map `403` `FORBIDDEN` to a permission state. Map `404` to not found. Map other `{ code, message }` bodies to an error state that shows `message`. Map a missing JSON body to a generic error that does not invent data.
6. Empty arrays are empty states. `dataState: "NOT_CONNECTED"` and null metrics are disconnected states. `202` with `status: "BLOCKED"` is a blocked scan, not success.
7. The FREE badge is product positioning copy. It is not evidence that the API returned data, and it does not imply ad spend, SMS, email, or Google quota is free.

Global navigation is not part of the v0 stage. `getDashboardNavModules()` does not yet point at these routes. Adding a href before `page.tsx` exists fails `scripts/validate-routes.mjs`. Each new workspace renders its own subnav to its own routes. Cursor adds shell links only after the pages exist.

## 4. API-to-screen matrix

Prisma JSON means the handler returns the Prisma row or rows selected in that route, serialized by `NextResponse.json`. Field lists are the Prisma models. This contract does not restate every column.

List limits: `CRM_LIST_MAX_TAKE` and `MKT_LIST_MAX_TAKE` and `SEO_LIST_MAX_TAKE` default to 100. CRM and marketing and SEO `take` query defaults are 50 where a `take` parameter exists. Values are clamped to at least 1.

### 4.1 CRM

Overview has no aggregate route. The screen calls the list endpoints and shows only what those lists return. Counts beyond the page size are unknown.

| Screen | Method and path | Request | Success body | Scope and gate | Filters | Actions the API supports | Class |
|---|---|---|---|---|---|---|---|
| Overview, contacts | `GET /api/v1/crm/contacts` | Query `take` optional | `{ contacts }` Prisma `CrmContact` plus `channelIdentities`, `status: ACTIVE`, `updatedAt` desc | `crm.read`. Account from the session | `take` only. No search, cursor, or status query | Read | PARTIAL and DISABLED |
| Contacts | `POST /api/v1/crm/contacts` | JSON `givenName?`, `familyName?`, `preferredName?`, `emails?` string[], `phones?` string[], `leadSource?`, `idempotencyKey?` | `201` `{ contact }` same include | `crm.write` | — | Create one contact | IMPLEMENTED and DISABLED |
| Contact 360 | `GET /api/v1/crm/contacts/[id]` | — | `{ contact }` Prisma `CrmContact` plus `channelIdentities` | `crm.read`. Wrong account is `404` `NOT_FOUND` | — | Read | PARTIAL and DISABLED. Consent rows are not included |
| Contact 360 | `PATCH /api/v1/crm/contacts/[id]` | JSON `givenName?`, `familyName?`, `preferredName?`, `jobTitle?` | `{ id }` | `crm.write` | — | Update those four fields | PARTIAL and DISABLED |
| Contact 360 | `GET /api/v1/crm/contacts/[id]/timeline` | — | `{ events }` Prisma `CrmTimelineEvent`, `eventAt` desc, take 50 inside the service | `crm.read`. An unknown or foreign contact returns `{ events: [] }`, not 404 | No query | Read | PARTIAL and DISABLED |
| Companies | `GET /api/v1/crm/companies` | — | `{ companies }` Prisma `CrmCompany`, name asc, take 50 fixed | `crm.read` | None | Read | PARTIAL and DISABLED |
| Companies | `POST /api/v1/crm/companies` | JSON `name` required, `websiteDomain?`, `industry?` | `201` `{ id }` | `crm.write` | — | Create. No detail or update route | PARTIAL and DISABLED |
| Pipeline | `GET /api/v1/crm/pipelines` | — | `{ pipelines }` Prisma `CrmPipeline` plus `stages` ordered by `sortOrder`. The handler also calls `ensureDefaultPipeline` for the actor account | `crm.read` | None | Read. Creating the default pipeline is a side effect of this read | IMPLEMENTED and DISABLED |
| Pipeline | `GET /api/v1/crm/deals` | — | `{ deals }` Prisma `CrmDeal`, `updatedAt` desc, take 50 fixed | `crm.read` | None | Read | PARTIAL and DISABLED |
| Pipeline | `POST /api/v1/crm/deals` | JSON `title` required, `contactId?`, `companyId?`, `amountMinorUnits?` | `201` `{ deal }` Prisma `CrmDeal` | `crm.write`. Uses the default pipeline and its first stage | — | Create on the first stage. No move-stage route | PARTIAL and DISABLED |
| Tasks | `GET /api/v1/crm/tasks` | — | `{ tasks }` Prisma `CrmTask`, `dueAt` asc, take 50 fixed | `crm.read` | None | Read | PARTIAL and DISABLED |
| Tasks | `POST /api/v1/crm/tasks` | JSON `title` required, `contactId?`, `dealId?`, `dueAt?` ISO string, `idempotencyKey?` | `201` `{ id }` | `crm.write` | — | Create. No complete or update route | PARTIAL and DISABLED |
| Segments | `GET /api/v1/crm/segments` | — | `{ segments }` Prisma `CrmSegment`, no take | `crm.read` | None | Read | PARTIAL and DISABLED |
| Segments | `POST /api/v1/crm/segments` | JSON `filterDefinition` required. `evaluateOnly: true` evaluates without saving. Otherwise `name` is required | Evaluate: `{ contactIds: string[], summary }` with `summary.totalContacts`, `eligibleContacts`, `suppressedContacts`, `unknownConsentContacts`. Save: `201` `{ id }` | Evaluate uses `crm.read`. Save uses `crm.admin` | `filterDefinition.logic` is `AND` or `OR`. Each rule is `{ field, operator, value }`. Fields: `tag`, `leadSource`, `createdAfter`, `createdBefore`, `lastActivityBefore`, `hasOpenDeal`, `followUpCoverage`, `consentEligible`, `notSuppressed`. Operators: `eq`, `neq`, `gte`, `lte`, `in` | Preview membership or save a dynamic segment. No segment detail route | PARTIAL and DISABLED. Population above `CRM_SEGMENT_EVAL_MAX_CONTACTS` (default 5000) returns `429` `QUOTA_EXCEEDED` |
| Import | `POST /api/v1/crm/imports/preview` | JSON `rows` required (`Record<string, string>[]`), `mapping` required (`Record<string, string>`), `fileName?` | `201` `{ jobId, previewReport }`. `previewReport` is `{ duplicates: { rowNumber, email }[], rowCount, consentGranted: false }` | `crm.import` plus `CRM_IMPORT_ENABLED` | — | Preview. Commit only reads mapping keys `email` and `givenName` | PARTIAL and DISABLED |
| Import | `POST /api/v1/crm/imports/commit` | JSON `jobId` and `commitIdempotencyKey` required | `{ committed: number, jobId }` | `crm.import` plus `CRM_IMPORT_ENABLED` | Duplicate preview rows are skipped | Commit the preview job | IMPLEMENTED and DISABLED |
| Import | `POST /api/v1/crm/exports` | JSON `cursor?`, `take?`, `targetAccountId?` | `{ csv: string, nextCursor?: string }`. Header is `id,givenName,familyName,primaryEmail` | `crm.export` plus `CRM_EXPORT_ENABLED`. `take` max is `CRM_EXPORT_PAGE_SIZE` (default 500) | Cursor is a contact id in the same account | Page through CSV | IMPLEMENTED and DISABLED |
| Settings | — | — | — | — | — | Custom fields, ownership rules, external sync, and consent editing have no customer route | NOT IMPLEMENTED. External sync is DEFERRED |

Contact 360 actions from the sitemap (chat, SMS, email, call) have no CRM HTTP route. Render them disabled. Do not link them to `/dashboard/messages`.

### 4.2 Marketing Studio

Marketing service successes return the `value` object directly (`mktServiceResponse`), not a `{ request }` wrapper, except where the route itself builds `{ requests }`, `{ request }`, `{ artifacts }`, `{ artifact, revisions }`, `{ evaluations }`, or `{ versions }`.

Request categories accepted by `POST /api/v1/marketing/requests`: `LANDING_PAGE`, `SEO_CONTENT_FIX`, `AD_CREATIVE`, `SOCIAL_CONTENT_PLAN`, `CAMPAIGN_PREPARATION`, `CRM_LEAD_FOLLOW_UP`.

| Screen | Method and path | Request | Success body | Scope and gate | Filters | Actions | Class |
|---|---|---|---|---|---|---|---|
| Overview, requests | `GET /api/v1/marketing/requests` | Query `take` optional | `{ requests }` Prisma `MarketingRequest`, `createdAt` desc | `marketing.read` | `take` only | Read | PARTIAL and DISABLED |
| Requests | `POST /api/v1/marketing/requests` | JSON `category`, `goal`, `brief`, `idempotencyKey` required. Optional `managedSiteId`, `locale` `en` or `es` (default `en`), `audience`, `sourceRefs` string[], `seoOpportunityId` | `201` `{ requestId, status }` | `marketing.request.create`. Also requires `MKT_DRAFT_PREPARATION_ENABLED` or `503` `NOT_CONFIGURED`. `managedSiteId` must belong to the actor account | — | Create a request. `seoOpportunityId` is the SEO-to-marketing link | IMPLEMENTED and DISABLED |
| Request detail | `GET /api/v1/marketing/requests/[id]` | — | `{ request }` Prisma `MarketingRequest` | `marketing.read`. Other accounts are `404` | — | Read | IMPLEMENTED and DISABLED |
| Request detail, deliverables | `GET /api/v1/marketing/requests/[id]/artifacts` | — | `{ artifacts }` Prisma `MarketingArtifact` for that request | `marketing.read` | — | Read artifacts for one request. There is no account-wide artifact list | PARTIAL and DISABLED |
| Request detail | `POST /api/v1/marketing/requests/[id]/prepare` | Empty body | `201` `{ artifactId, revisionNumber, revisionHash }` | `marketing.artifact.prepare` plus `MKT_DRAFT_PREPARATION_ENABLED` | — | Prepare one deterministic draft | IMPLEMENTED and DISABLED. Not a live model call |
| Deliverable detail | `GET /api/v1/marketing/artifacts/[id]` | — | `{ artifact, revisions }` Prisma artifact and `MarketingArtifactRevision` ordered by `revisionNumber` | `marketing.read` | — | Read | IMPLEMENTED and DISABLED |
| Deliverable detail | `POST /api/v1/marketing/artifacts/[id]/revisions` | JSON `structuredContent` object required | `201` `{ revisionNumber, revisionHash }` | `marketing.artifact.prepare` plus draft flag. Cap `MKT_MAX_REVISIONS_PER_ARTIFACT` (default 25) | — | Append a revision. Pending reviews for that artifact are revoked | IMPLEMENTED and DISABLED |
| Approvals | `POST /api/v1/marketing/artifacts/[id]/submit-review` | JSON `revisionHash` and `intendedAction` required, `allowedChannel?` | `201` `{ reviewId }` | `marketing.artifact.review` (OWNER) plus `MKT_APPROVAL_WORKFLOW_ENABLED` | — | Submit the current revision. Hash must match the artifact | IMPLEMENTED and DISABLED |
| Approvals | `POST /api/v1/marketing/reviews/[id]/decide` | JSON `decision` `APPROVED` or `REJECTED` | JSON `true` | `marketing.artifact.review`. Actor type sent by the route is `USER` | — | Decide one known review. There is no list-reviews route | PARTIAL and DISABLED |
| Overview follow-ups | `GET /api/v1/marketing/follow-ups` | Query `take` optional | `{ evaluations }` Prisma `MarketingLeadFollowUpEvaluation` | `marketing.followup.read` | `take` only | Read stored evaluations | IMPLEMENTED and DISABLED |
| Overview follow-ups | `POST /api/v1/marketing/follow-ups/evaluate` | JSON `idempotencyKey?`, `limit?` | `{ rows, summary }`. Each row is `{ contactId, coverageState, dueAt?, evidenceRefs, recommendedAction? }`. `summary` is `Record<string, number>` | `marketing.followup.manage` plus `MKT_LEAD_MONITOR_ENABLED` | — | Evaluate. Does not send a message | IMPLEMENTED and DISABLED |
| Overview follow-ups | `POST /api/v1/marketing/follow-ups/[id]/prepare-task` | JSON `assignedUserId` and `idempotencyKey` required | `201` `{ taskId, created }` | `marketing.followup.manage`. Evaluation must be in the actor account | — | Prepare a CRM callback task. Does not contact the person | IMPLEMENTED and DISABLED |
| Brand context (request form support, not its own nav item) | `GET /api/v1/marketing/sites/[siteId]/brand-context` | — | `{ versions }` Prisma `MarketingBrandContextVersion`, latest 10 | `marketing.read`. Site must be in the account | — | Read | IMPLEMENTED and DISABLED |
| Brand context | `POST /api/v1/marketing/sites/[siteId]/brand-context` | JSON `businessName` required. Optional `locale`, `approvedServices` string[], `audience`, `brandTone`, `approvedClaims` string[] | `201` `{ versionId, versionNumber }` | `marketing.brand.manage` (OWNER) | — | Save a version | IMPLEMENTED and DISABLED |
| Campaigns | `GET /api/v1/social/campaigns` | — | `{ campaigns }` Prisma `SocialCampaign`, take 50 | Social flag. Account from the session. No site filter | None | Read | PARTIAL and DISABLED |
| Campaigns | `POST /api/v1/social/campaigns` | JSON `goal`, `locale` `en` or `es`, `targetPlatforms` non-empty string[] required. Optional `targetAudience`, `brandProfile`, `idempotencyKey` | `201` `{ campaign }` Prisma `SocialCampaign` | Social flag, then draft quota (`MARKETING_STUDIO_DRAFTS_PER_MONTH`, default 50) | — | Create a draft campaign. Site id is not taken from the body | PARTIAL and DISABLED |
| Campaign detail | `POST /api/v1/social/campaigns/[id]/revisions` | JSON `captionEn` and `targetChannelIds` string[] required. Optional `captionEs`, `scheduledAt`, `mediaRefs`, `platformPayloads` | `201` `{ revision }` which is `{ id, contentHash, revisionNumber }` | Social flag. Campaign must be in the account. Channel ids are validated for the account | — | Save a revision. This does not approve or publish | IMPLEMENTED and DISABLED |
| Campaign detail | `POST /api/v1/social/campaigns/[id]/approve` | Body ignored | `501` `{ code: "PENDING_PILOT", message }` after the flag check | Social flag | — | None. Domain approval is not wired to this route | NOT IMPLEMENTED on HTTP. DEFERRED until a later backend batch |
| Schedule | `GET /api/v1/social/calendar` | Query `from` and `to` ISO dates. Defaults are now and now plus 30 days | `{ from, to, campaigns }` Prisma campaigns whose `startDate` or `endDate` falls in the window, take 200 | Social flag | Date window only. Invalid dates become an Invalid Date query and can 500 | Read campaign date overlap. This is not a post-level calendar | PARTIAL and DISABLED |
| Schedule | `GET /api/v1/social/publications` | — | `{ publications }` Prisma `SocialPublication`, take 100 | Social flag | None | Read stored publication rows | IMPLEMENTED and DISABLED |
| Schedule | `POST /api/v1/social/campaigns/[id]/schedule` | Body ignored | Flag off: `503` `NOT_CONFIGURED`. Flag on: `501` `PENDING_PILOT` | `POSTIZ_LIVE_PUBLISHING_ENABLED` | — | No schedule is created | DEFERRED |
| Connections | `GET /api/v1/social/connections` | — | `{ connections }` Prisma `BusinessSocialConnection`, take 100 | Social flag | None | Read. No connect or disconnect route | PARTIAL and DISABLED. OAuth connect is DEFERRED |
| Social handoff from an approved artifact | no route | — | — | `prepareSocialHandoffFromApprovedCreative` is a server function, not HTTP | — | Do not call it from the browser | NOT IMPLEMENTED as a customer API |

The deliverables index must be built by listing requests and then loading each request’s artifacts, or by opening an artifact id the user already has. Do not invent `GET /api/v1/marketing/artifacts`.

The approvals index has no list route. Show the disabled or empty explanation, and keep decide/submit on the deliverable detail where a `reviewId` or `revisionHash` is already known. Do not duplicate `/dashboard/approvals`.

Do not add a social analytics page. Post performance metrics are not on these routes. `/dashboard/analytics` remains the analytics product.

### 4.3 Local SEO

Overview success body is `{ overview }` matching `SeoSiteOverviewDto` in `lib/platform/seo/dashboard-read-model.ts`. `loadSeoSiteOverview` passes `gsc: null`, so `sections.gscPerformance.clicks`, `impressions`, `ctr`, and `averagePosition` stay null on this route. If a GSC connection exists and is not `NOT_CONNECTED`, only `dataState` is overwritten from that connection. Numeric search totals come from the performance route, and only when stored observations and a snapshot exist.

`SeoDataState` values: `NOT_CONNECTED`, `FETCHING`, `READY`, `PARTIAL`, `STALE`, `ERROR`, `NOT_SUPPORTED`.

Page `status` filter, if sent, must be one of `DISCOVERED`, `CRAWLED`, `DRAFT`, `PREVIEW`, `PUBLISHED`, `REMOVED`, `UNVERIFIED`. Any other value is not a supported filter.

| Screen | Method and path | Request | Success body | Scope and gate | Filters | Actions | Class |
|---|---|---|---|---|---|---|---|
| Site selector support | `GET /api/v1/seo/sites` | — | `{ sites: { id, name, domain, canonicalUrl, status }[] }` | `seo.read` | None | Optional cross-check. The page selector must not depend on it | IMPLEMENTED and DISABLED |
| Overview | `GET /api/v1/seo/sites/[siteId]/overview` | — | `{ overview: SeoSiteOverviewDto }` | `seo.read`. Other-account site is `404` `NOT_FOUND` | None | Read freshness, page counts, connection states, up to 10 opportunities, up to 5 competitors | PARTIAL and DISABLED. GSC totals are null here |
| Pages | `GET /api/v1/seo/sites/[siteId]/pages` | Query `take` optional, `status` optional | `{ pages }` Prisma `SitePageInventory` | `seo.read` and both ids | `take`, `status` | Read | IMPLEMENTED and DISABLED |
| Pages | `GET /api/v1/seo/sites/[siteId]/findings` | Query `take` optional | `{ findings }` Prisma `SeoPageFinding`, `observedAt` desc | `seo.read` | `take` only | Read evidence findings | IMPLEMENTED and DISABLED |
| Pages | `POST /api/v1/seo/sites/[siteId]/scan-previews` | JSON `idempotencyKey` required, `maxPages?`, `maxDepth?` | `202` `{ crawlRunId, status, message }`. `status` is `PREPARED` or `BLOCKED` | `seo.scan.prepare`. Crawler flag off yields `BLOCKED` and message `Crawler activation disabled (SEO_CRAWLER_ENABLED=false)` | — | Prepare a crawl record. Do not tell the user a crawl ran | IMPLEMENTED and DISABLED for live crawl. DEFERRED to run a crawl |
| Keywords | `GET /api/v1/seo/sites/[siteId]/performance` | — | `{ gsc: GscPerformanceReadModel }` from `lib/platform/seo/gsc-performance-read.ts` | `seo.read`. No GSC connection returns `dataState: "NOT_CONNECTED"` and null metrics. A connection without a snapshot returns `dataState: "PARTIAL"` and null metrics | None. The route aggregates up to 25000 stored keyword rows. It does not return those rows | Read one aggregate. Show `averagePositionLabel` (`GSC average position (not fixed rank)`) whenever a position is displayed | PARTIAL and DISABLED. A per-query table is NOT IMPLEMENTED |
| Local market | `GET /api/v1/seo/sites/[siteId]/competitors` | — | `{ markets, competitors }`. Markets are Prisma `CompetitorMarket`. Competitors are Prisma `CompetitorProfile` where `excluded` is false, `rankScore` desc, take 5 | `seo.read` | None | Read | PARTIAL and DISABLED |
| Local market | `POST /api/v1/seo/sites/[siteId]/markets` | JSON `name` and `category` required. Optional `services` string[], `radiusKm`, `keywordThemes` string[], `candidateCompetitors` | `201` `{ marketId, competitors }` where `competitors` is the ranked result of `createCompetitorMarket` | `seo.market.manage` | — | Create a market from supplied candidates. This does not call Google Places | IMPLEMENTED and DISABLED. Live Places discovery is DEFERRED (`SEO_PLACES_API_ENABLED`) |
| Opportunities | `GET /api/v1/seo/sites/[siteId]/opportunities` | Query `take` optional | `{ opportunities }` Prisma `SeoOpportunity`, `priorityScore` desc | `seo.read` | `take` only | Read. No accept, dismiss, or execute route | PARTIAL and DISABLED. Execution is DEFERRED |
| Connections | `GET /api/v1/seo/sites/[siteId]/connections` | — | `{ connections }` with only `id`, `provider`, `propertyRef`, `propertyKind`, `verificationState`, `dataState`, `lastVerifiedAt`, `revokedAt` | `seo.read` | None | Read status. No OAuth start route exists under `app/api` | PARTIAL and DISABLED. Connecting Google is DEFERRED |

Rank language: never render a single “your position” from a null `averagePosition`. The overview rank provider state is forced through `localRankWhenProviderDisconnected()` while the rank provider flag stays off. Show that as disconnected.

An opportunity may deep-link into Marketing request create by placing its id in `seoOpportunityId`. The marketing create route is still disabled until both backend flags and OPEN-001 allow it. The control must show that disabled state.

## 5. UI and localization requirements

v0 builds English and Spanish copy for every new screen. Import the locale modules from the page. Do not edit `lib/i18n/dictionaries/en.ts` or `es.ts` in the v0 stage. Existing nav labels `dashboard.nav.crm` and `dashboard.nav.seo` already exist. There is no Marketing Studio nav label yet. Cursor adds that label when it wires navigation.

Each workspace:

- Uses the current shell, account switcher, and project switcher by living under the dashboard layout. Do not redesign them.
- Shows one FREE badge on the workspace title. Marketing Studio keeps the prominent badge from the sitemap. CRM and Local SEO use the same approved free positioning, with the fair-use line that carrier, ad, and provider use are separate.
- Stacks on small screens. The shell already supplies the mobile drawer. New pages supply a reachable subnav, visible focus, and labeled form controls.
- Uses `PageTitle` and `EmptyState` from `components/dashboard/primitives.tsx` by import. New visual pieces go in the new component folders. Do not edit `components/dashboard/**`.
- Renders loading, empty, disabled, disconnected, permission, and error states for every data region.
- Does not fabricate rows to fill an empty database.
- Does not start Google OAuth, Postiz publish, SMS, email, payment, AI execution, or a production schedule.

Copy must include, in both languages:

- Disabled backend (`*_DISABLED` or social `403`).
- Eligibility unresolved (`POLICY_UNRESOLVED`), without inventing who is eligible.
- Import, export, draft preparation, approval, and lead monitor each unavailable on their own flags.
- Scan `BLOCKED` versus a finished crawl.
- GSC average position is not a fixed rank, and null metrics stay blank.
- Social approve is unavailable (`PENDING_PILOT`) and schedule is unavailable (`NOT_CONFIGURED` or `PENDING_PILOT`).
- Contact channel actions and CRM settings that have no API.

## 6. File ownership

One owner per path per stage. Importing a module is allowed. Editing it is not.

### Stage A — this contract (Cursor)

| Path | Owner |
|---|---|
| `docs/platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md` | Cursor |
| `docs/PROJECT_MEMORY.md`, `docs/SESSION_HANDOFF.md`, `docs/CHANGELOG.md`, `docs/ROUTE_MAP.md`, `docs/DATA_AND_SERVICES.md` | Cursor |
| `docs/platform/docs/02-CURRENT-STATE.md`, `docs/platform/docs/13-IMPLEMENTATION-ROADMAP.md` | Cursor, status lines only |

### Stage B — UI (v0.app creates these paths; Cursor does not edit them)

| Path | Owner |
|---|---|
| `app/[locale]/dashboard/crm/**` | v0.app |
| `app/[locale]/dashboard/marketing/**` | v0.app |
| `app/[locale]/dashboard/seo/**` | v0.app |
| `components/crm/**` | v0.app |
| `components/marketing-studio/**` | v0.app |
| `components/local-seo/**` | v0.app |
| `lib/crm-ui/**` | v0.app |
| `lib/marketing-studio-ui/**` | v0.app |
| `lib/local-seo-ui/**` | v0.app |
| `lib/i18n/dictionaries/crm-workspace-en.ts` | v0.app |
| `lib/i18n/dictionaries/crm-workspace-es.ts` | v0.app |
| `lib/i18n/dictionaries/marketing-studio-en.ts` | v0.app |
| `lib/i18n/dictionaries/marketing-studio-es.ts` | v0.app |
| `lib/i18n/dictionaries/local-seo-workspace-en.ts` | v0.app |
| `lib/i18n/dictionaries/local-seo-workspace-es.ts` | v0.app |

### Stage B — frozen (neither owner edits)

| Path | Why it stays untouched |
|---|---|
| `components/dashboard/**` including `shell.tsx`, `account-switcher.tsx`, `project-switcher.tsx`, `primitives.tsx` | Existing portal shell |
| `app/[locale]/dashboard/layout.tsx` and every existing dashboard `page.tsx` outside the three new trees | Existing portal screens, including Analytics, messages, approvals, and billing |
| `app/[locale]/dashboard/analytics/**`, `components/analytics/**`, `lib/analytics-ui/**` | Example only |
| `app/api/v1/crm/**`, `app/api/v1/marketing/**`, `app/api/v1/social/**`, `app/api/v1/seo/**` | Cursor backend |
| `lib/platform/**`, `lib/portal/**`, `config/**`, `prisma/**` | Cursor backend, auth, and flags |
| `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts` | Shared dictionaries. v0 does not need them if pages import the new modules |

Do not create `app/[locale]/dashboard/social/**`, `app/[locale]/dashboard/communications/**`, or `app/[locale]/dashboard/crm/leads/**`.

### Stage C — after a v0 handoff lists the edited paths (Cursor, sequential)

v0 stops editing the Stage B paths before Cursor starts.

| Path | Cursor change |
|---|---|
| `lib/portal/modules.ts` | Add nav entries only after each `page.tsx` exists |
| `lib/i18n/dictionaries/en.ts` and `es.ts` | Add a Marketing Studio nav label if the shell needs one |
| `docs/ROUTE_MAP.md` and the handoff docs | Record the pages that actually exist |
| Focused route and continuity checks | Confirm new hrefs resolve |

No stage transfers ownership of `app/api/**` or `lib/platform/**` to v0.app.

**Stage C path reconciliation (Batch 16C):** v0.app’s first Local SEO delivery used `components/seo-workspace/**`, `lib/seo-workspace-ui/**`, and `seo-workspace-en.ts` / `seo-workspace-es.ts`. Cursor renamed those paths to the Stage B names in this contract (`components/local-seo/**`, `lib/local-seo-ui/**`, `local-seo-workspace-en.ts`, `local-seo-workspace-es.ts`) with import updates only. No other Stage B visual files were edited.

## 7. Missing backend items

These are gaps for a later Cursor batch. They are not v0 workarounds and not permission to invent responses.

| Gap | Class |
|---|---|
| CRM search, cursor pagination, deal stage move, task update, consent read/write | Implemented in Batch 17A backend (see `BATCH17B-CRM-UI-INTEGRATION-CONTRACT.md` for UI). Still DISABLED at source flag defaults |
| Company detail HTTP, custom fields, suppression lift API | NOT IMPLEMENTED |
| Account-wide marketing artifact list and marketing review list | NOT IMPLEMENTED |
| HTTP social handoff, HTTP social approve, live schedule, channel connect | NOT IMPLEMENTED or DEFERRED (`501` / `503`) |
| Per-query keyword rows, SEO overview GSC totals, OAuth connect, crawl execution, opportunity execution, live rank | NOT IMPLEMENTED or DEFERRED |
| Stable `{ code, message }` for `AuthError` on CRM, Marketing, and SEO routes | PARTIAL |
| Social route does not apply the OPEN-001 `503` used by the other three families | PARTIAL |
| `GET /api/v1/social/calendar` can throw on an unparseable date | PARTIAL |

## 8. Execution sequence

1. Cursor records this contract on `feature/batch-16a-customer-workspace-contract`. No UI and no flags.
2. Owner reviews the route lock. v0.app then builds only Stage B paths, including disabled states, in English and Spanish.
3. v0.app returns a handoff that lists every edited path and the verification evidence. v0.app stops editing those paths.
4. Cursor wires navigation and dictionary labels, runs the route checker, and updates the living blueprint. Still no production migration and no flag enablement.
5. A later, separately authorized batch may add the missing HTTP contracts. Activation of Google, Postiz, SMS, email, AI, or schedules remains its own owner authorization.

## 9. Acceptance for this contract stage

- The three route trees above are the only new customer pages.
- Every screen names an existing method and path, or an explicit NOT IMPLEMENTED / DEFERRED gap.
- No response key in this document is invented beyond the handlers and types cited.
- Flag-off and `POLICY_UNRESOLVED` behavior is classified as unavailable.
- Stage B paths do not overlap Cursor paths.
- `docs/PROJECT_MEMORY.md` and `docs/SESSION_HANDOFF.md` record `main` at `2b7ec7be2aeadccfb595a2ab7edf59b775876efe`.

## 10. v0.app assignment

Build the Batch 16 customer workspaces from `docs/platform/docs/BATCH16-CUSTOMER-BUSINESS-WORKSPACE-CONTRACT.md` on branch `feature/batch-16a-customer-workspace-contract` (baseline `main` `2b7ec7be2aeadccfb595a2ab7edf59b775876efe`).

Create only the Stage B files in section 6. Do not edit the dashboard shell, existing portal pages, API routes, `lib/platform/**`, `lib/portal/**`, Prisma, flags, or `en.ts` / `es.ts`.

Implement all three workspaces, both languages, desktop and mobile, with loading, empty, disabled, disconnected, permission, and error states driven by the matrix in section 4. Keep the FREE badge. Do not invent data when a gate returns `503` or `403`, when a list is empty, or when metrics are null. Do not add Social, Communications, or CRM leads as separate route trees. Do not enable flags or call live Google, Postiz, SMS, email, or AI execution.

Return the edited paths and the screens you verified. Stop after that handoff. Cursor will wire navigation only after those pages exist.
