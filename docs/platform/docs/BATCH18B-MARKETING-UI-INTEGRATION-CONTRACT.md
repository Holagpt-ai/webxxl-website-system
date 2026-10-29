# Batch 18B — Marketing Studio deliverables & approvals UI (v0.app)

**Status:** contract for the next UI pass. Backend Batch 18A implements the HTTP surface below.  
**Baseline:** GitHub `main` after Batch 18A merge. **UI owner:** v0.app. **Backend owner:** Cursor (frozen for Stage B).

Do not call these routes when Marketing returns `503` `MKT_DISABLED` or `POLICY_UNRESOLVED`. Render the same unavailable states as Batch 16. When `MKT_APPROVAL_WORKFLOW_ENABLED` is off, approval inbox and decide actions stay disabled even if list routes respond.

## Scope (v0.app-owned files only)

| Path | Change |
|---|---|
| `app/[locale]/dashboard/marketing/deliverables/page.tsx` | Account-wide deliverables list (replace per-request fan-out) |
| `app/[locale]/dashboard/marketing/approvals/page.tsx` | Real approval inbox from review records |
| `app/[locale]/dashboard/marketing/deliverables/[artifactId]/page.tsx` | Keep detail; link from list |
| `components/marketing-studio/deliverables.tsx` | Wire list + filters + pagination |
| `components/marketing-studio/deliverable-detail.tsx` | Unchanged unless copy/state tweaks |
| Approvals-related marketing-studio components | Wire inbox, status, decide affordances |
| `lib/marketing-studio-ui/**` | Client fetch helpers, types, SWR keys |
| `lib/i18n/dictionaries/marketing-workspace-en.ts`, `marketing-workspace-es.ts` | Bilingual labels for filters, statuses, empty/disabled states |

Do not edit `lib/platform/marketing/**` or `app/api/v1/marketing/**` in Batch 18B.

## New HTTP contracts (Batch 18A)

All routes use session-derived `CustomerAccount`. No `customerAccountId` in query or body.

### Account-wide deliverables

**`GET /api/v1/marketing/artifacts`** — `marketing.read` (+ existing MKT backend / entitlement gates)

| Query | Meaning |
|---|---|
| `take` | Optional page size (1–100, default 50) |
| `cursor` | Opaque cursor from prior `nextCursor` |
| `managedSiteId` | Optional; must belong to the session account |
| `marketingRequestId` or `requestId` | Optional; must belong to the session account |
| `artifactType` | Optional enum: `SOCIAL_CAMPAIGN`, `SOCIAL_POST`, `LANDING_PAGE`, `AD_CREATIVE`, `SEO_FIX`, `CAMPAIGN_PLAN` |
| `reviewStatus` | Optional artifact-level enum filter (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `EXPIRED`, `REVOKED`) |

**200**

```json
{
  "artifacts": [
    {
      "id": "…",
      "customerAccountId": "…",
      "managedSiteId": "…|null",
      "marketingRequestId": "…|null",
      "artifactType": "LANDING_PAGE",
      "revisionHash": "…",
      "generationMode": "DETERMINISTIC_DRAFT",
      "reviewStatus": "DRAFT",
      "locale": "en",
      "safetyClass": "GENERAL_BUSINESS",
      "createdAt": "ISO-8601"
    }
  ],
  "nextCursor": "optional-opaque-string"
}
```

List items **omit** `payload` and revision bodies. Load detail via existing **`GET /api/v1/marketing/artifacts/[id]`**.

Errors: `400` `VALIDATION` (bad cursor, unknown site/request filter), `403`/`503` gates unchanged.

Preserve **`GET /api/v1/marketing/requests/[id]/artifacts`** for request-scoped views.

### Account-wide approval inbox

**`GET /api/v1/marketing/reviews`** — `marketing.read`

| Query | Meaning |
|---|---|
| `take`, `cursor` | Same pagination rules as artifacts |
| `managedSiteId` | Optional account-scoped site |
| `marketingRequestId` / `requestId` | Optional account-scoped request |
| `marketingArtifactId` / `artifactId` | Optional account-scoped artifact |
| `status` | Optional effective bucket: `SUBMITTED` (non-expired pending), `APPROVED`, `REJECTED`, `REVOKED`, `EXPIRED` |

**200**

```json
{
  "reviews": [
    {
      "id": "…",
      "marketingArtifactId": "…",
      "marketingRequestId": "…",
      "managedSiteId": "…|null",
      "revisionHash": "…",
      "status": "SUBMITTED",
      "effectiveStatus": "SUBMITTED",
      "intendedAction": "…",
      "allowedChannel": "…|null",
      "allowedTarget": "…|null",
      "policyVersion": "mkt-08-v1",
      "expiresAt": "ISO-8601|null",
      "decidedAt": "ISO-8601|null",
      "revokedAt": "ISO-8601|null",
      "createdAt": "ISO-8601",
      "approverUserId": "…|null",
      "allowedActions": {
        "canDecide": false,
        "intendedAction": "…",
        "allowedChannel": "…|null",
        "allowedTarget": "…|null"
      }
    }
  ],
  "nextCursor": "optional"
}
```

**UI rules**

- Treat **`effectiveStatus`** (not artifact `reviewStatus` alone) as the inbox truth for pending/expired.
- **`allowedActions.canDecide`** is true only when `MKT_APPROVAL_WORKFLOW_ENABLED` is on, the viewer has `marketing.artifact.review`, and `effectiveStatus === 'SUBMITTED'`.
- **`POST .../submit-review`** returns **`409 CONFLICT`** when an active pending review already exists for the same artifact revision (artifact CAS + pending guard).
- Decide via existing **`POST /api/v1/marketing/reviews/[id]/decide`** (`APPROVED` | `REJECTED`).
- Submit via existing **`POST /api/v1/marketing/artifacts/[id]/submit-review`**.

## Disabled and error states

| Condition | UX |
|---|---|
| `MKT_DISABLED` / entitlement off | Same Marketing Studio unavailable shell as Batch 16 |
| `POLICY_UNRESOLVED` | Unresolved-policy message; no fabricated deliverables |
| `MKT_APPROVAL_WORKFLOW_ENABLED` off | Approvals page explains workflow disabled; do not fake pending rows |
| Empty lists | Honest empty states in EN and ES |
| `400` bad cursor | Reset pagination; show validation message |

## Deferred (not 18B)

- Postiz publishing, OAuth, live social calendar execution
- Paid AI generation routes
- Account-wide marketing analytics
- Billing or wallet changes
