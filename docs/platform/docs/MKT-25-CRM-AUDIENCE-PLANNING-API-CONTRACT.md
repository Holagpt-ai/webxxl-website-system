# MKT-25 — CRM Segment Audience Planning API (v0 handoff)

**Status:** IMPLEMENTED in Batch 25 (backend only). **Not** outreach authorization. **Not** production migration applied by this batch.

## Gates (all routes)

| Gate | Env / check | Failure |
|---|---|---|
| OPEN-001 subscriber | `requireIncludedFreeSoftwareMembership('core.marketing-studio')` | `403` `FREE_SOFTWARE_NOT_ELIGIBLE` |
| Marketing backend | `MKT_BACKEND_ENABLED=true` | `503` `MKT_DISABLED` |
| CRM audience planning | `MKT_CRM_AUDIENCE_PLANNING_ENABLED=true` | `503` `NOT_CONFIGURED` |
| CRM backend | `CRM_BACKEND_ENABLED=true` | `503` `NOT_CONFIGURED` |
| CRM read | membership `crm.read` | `403` `FORBIDDEN` |
| Draft preparation (create only) | `MKT_DRAFT_PREPARATION_ENABLED=true` | `503` `NOT_CONFIGURED` |

Tenant scope is always the authenticated session `CustomerAccount`. Cross-account segment IDs return `404` `NOT_FOUND`.

## 1. List saved segments (planning picker)

`GET /api/v1/marketing/crm-segments`

**Permission:** `marketing.read` + `crm.read`

**200**

```json
{
  "segments": [
    {
      "id": "seg_…",
      "name": "Newsletter VIP",
      "kind": "DYNAMIC",
      "updatedAt": "2026-10-31T12:00:00.000Z",
      "audiencePlanningEligible": true
    }
  ]
}
```

## 2. Audience preview (planning evidence)

`POST /api/v1/marketing/crm-segments/{segmentId}/audience-preview`

**Permission:** `marketing.read` + `crm.read`

**200**

```json
{
  "segmentId": "seg_…",
  "segmentName": "Newsletter VIP",
  "segmentKind": "DYNAMIC",
  "segmentUpdatedAt": "2026-10-31T11:00:00.000Z",
  "evaluatedAt": "2026-10-31T12:00:00.000Z",
  "planningOnly": true,
  "notSendAuthorization": true,
  "accountContactCount": 1200,
  "audience": {
    "totalMatchedContacts": 340,
    "marketingConsentGrantedContacts": 210,
    "revokedExpiredOrSuppressedContacts": 80,
    "unknownMarketingConsentContacts": 40,
    "missingUsableEmailContacts": 25
  },
  "disclosures": {
    "synchronousEvaluationLimit": 5000,
    "limitAppliesToActiveContactsInAccount": true,
    "consentStatesArePointInTime": true,
    "outboundExecutionRequiresFreshEvaluation": true
  }
}
```

Audience buckets are **independent counts** (may overlap). Consent uses Batch 24B `resolveEffectiveMarketingConsent` (EMAIL/MARKETING only). Missing email = no usable EMAIL identity on the contact.

**Errors**

| HTTP | code | When |
|---|---|---|
| 404 | `NOT_FOUND` | Segment not in account |
| 429 | `QUOTA_EXCEEDED` | Active contacts > `CRM_SEGMENT_EVAL_MAX_CONTACTS` |
| 400 | `VALIDATION` | Segment not evaluable (e.g. dynamic without rules) |
| 503 | `NOT_CONFIGURED` / `MKT_DISABLED` | Module flags off |

## 3. Create draft campaign-preparation request (segment-linked)

`POST /api/v1/marketing/requests`

**Permission:** `marketing.request.create` + `crm.read` (when `crmSegmentId` present)

**Body (segment path)**

```json
{
  "category": "CAMPAIGN_PREPARATION",
  "crmSegmentId": "seg_…",
  "goal": "Re-engage warm leads",
  "brief": "…",
  "locale": "en",
  "idempotencyKey": "uuid-…",
  "managedSiteId": "optional",
  "audienceLabel": "Optional display label only"
}
```

- **`audience` / `audienceLabel`:** human copy only; **not** proof of CRM membership.
- **Verifiable link:** `sourceRefs` includes `crm:segment:{segmentId}`; row stores `crmSegmentId`, `audienceEvaluatedAt`, `audiencePlanningSummary` snapshot.
- **Status:** `DRAFT` (planning handoff; not outbound execution).

**201**

```json
{
  "requestId": "req_…",
  "status": "DRAFT",
  "crmSegmentId": "seg_…",
  "audiencePreview": { }
}
```

**Idempotency:** same as existing marketing requests (global key; `409` `CONFLICT` on payload mismatch).

**Errors:** same as preview plus validation if `category` ≠ `CAMPAIGN_PREPARATION` when `crmSegmentId` set.

## 4. Review request (unchanged)

`GET /api/v1/marketing/requests` and `GET /api/v1/marketing/requests/{id}` — existing Marketing Studio read APIs. Linked requests expose `crmSegmentId` and `audiencePlanningSummary` when present (after migration).

## EN/ES UI copy (v0)

| Key idea | English | Spanish |
|---|---|---|
| Planning banner | Audience counts are planning evidence only. They do not authorize email or SMS sends. | Los conteos de audiencia son evidencia de planificación únicamente. No autorizan envíos de correo ni SMS. |
| Consent bucket | With current email marketing consent | Con consentimiento de marketing por correo vigente |
| Revoked bucket | Revoked, expired, or suppressed | Revocado, vencido o suprimido |
| Unknown bucket | Unknown marketing consent | Consentimiento de marketing desconocido |
| Email bucket | Missing usable email | Sin correo utilizable |
| Limit | Evaluation limited to {limit} active contacts per account | Evaluación limitada a {limit} contactos activos por cuenta |
| Stale segment | Segment changed after last evaluation. Preview again before submitting. | El segmento cambió después de la última evaluación. Vuelva a obtener la vista previa antes de enviar. |

Compare `segmentUpdatedAt` vs last preview `evaluatedAt` in UI for stale warning (API does not block on stale preview at create; create re-evaluates at submission).

## Deferred (explicit)

- Production migration apply for `MarketingRequest.crmSegmentId` columns
- `MKT_CRM_AUDIENCE_PLANNING_ENABLED` activation
- Outbound delivery, provider jobs, schedules
