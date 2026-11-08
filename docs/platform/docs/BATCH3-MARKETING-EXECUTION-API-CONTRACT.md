# Batch 3 — Marketing & Social Execution summary API contract

**Issue:** #117 · **ADR:** not required (composes Batch 34 execution gates, CRM audience planning, MKT-08 handoff).

## Route

`GET /api/v1/marketing/execution/summary`

### Query

| Param | Required | Description |
|---|---|---|
| `managedSiteId` | No | When set, scopes workflow/review counts to the site; must belong to session account or `404` |
| `customerAccountId` | No | If present, must match session account or `403` |

### Auth

- Session `requireCustomerMembership`
- Marketing slices: `MKT_BACKEND_ENABLED`, OPEN-001 `core.marketing-studio`, `marketing.read`
- CRM audience slice: additionally `core.crm` (planning-only; **not** send authorization)
- Social readiness slice: `SOCIAL_MARKETING_ENABLED`, `SOCIAL_EXECUTION_GATES_ENABLED`, OPEN-001 `core.social-automation` + `core.marketing-studio`, `marketing.read`

Denied gates return per-slice `UNAVAILABLE` with `reasonCode` — the route does not 500 for disabled social or CRM modules.

### Response

`{ summary: MarketingExecutionSummaryResponse }` — see `lib/platform/marketing-execution/types.ts`.

| Slice | Source (reused) | Notes |
|---|---|---|
| `workflowCounts` | Prisma aggregates + DB-side review effective counts | Publication counts scoped via `SocialCampaign.managedSiteId` when `managedSiteId` query is set. Execution ladder: `SCHEDULED` uses `SCHEDULED` publications only (`PENDING` stays in `publicationStatus` only). `PUBLISHED` requires `publishedUrl`. |
| `reviewEvidence` | `MarketingArtifactReview` rows (bounded, no artifact bodies) | Expiry/revocation reflected in `effectiveStatus` |
| `crmAudiencePlanning` | `listCrmSegmentsForAudiencePlanning`, `previewCrmSegmentAudience` | `planningOnly` + `notSendAuthorization: true` |
| `socialProviderReadiness` | `buildPostizProviderReadiness` → `mapPostizReadinessForExecutionSummary` | Omits secret refs; `dispatchBlockedCode` always `PREPARATION_ONLY_DISPATCH_BLOCKED`; `postizApiEnabled` / `livePublishingEnabled` reflect env truthfully; channel `dispatchAllowed` always false |
| `socialHandoffPolicy` | `prepareSocialHandoffFromApprovedCreative` policy surface | Always `PREPARATION_ONLY` with `dispatchBlocked: true`; flags reported honestly but do not authorize dispatch on this route |

### Creative → social handoff (server)

`prepareApprovedCreativeSocialHandoff` in `lib/platform/marketing/social-handoff-service.ts` validates tenant, social artifact type, immutable `revisionHash`, effective `APPROVED` review, and optional channel scope. Returns `schedulingAllowed: false`. Does not call Postiz.

### v0 Stage B handoff (Cursor does not edit these paths)

Optional Marketing Studio execution panel:

- **Paths:** `app/[locale]/dashboard/marketing/**`, `components/marketing-studio/**` (not `dashboard/business/**`).
- **Fetch:** `GET /api/v1/marketing/execution/summary?managedSiteId=`
- **UI:** render each slice when `status === 'AVAILABLE'`; show `reasonCode` + `message` otherwise; never imply send/publish from queue or `PREPARED` state; keep CRM consent copy visible (`planningDisclosure`).

### Runtime gates (unchanged)

No live Postiz publish, OAuth, migrations, SMS/email sends, or flag activation in this batch.
