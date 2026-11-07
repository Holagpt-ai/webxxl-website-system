# CRM page entitlement contract (Issue #105)

**Status:** server contract + CRM layout **MERGED** on `main` @ `e37f0a023dd289dc3a9b4e7484f6a1dd34b24276` ([PR #106](https://github.com/Holagpt-ai/webxxl-website-system/pull/106)). v0 integration from `v0/crm-entitlement-ui-105` @ `212fdf43d3dafeec906a5527cbefea0d78983cb5`. Pilot A/B **core** entitlement acceptance **passed** on integrated staging Preview (Issue #105, 2026-11-07). Issue #105 retains remaining targeted tests.  
**Decisions:** ADR-003 (Cursor backend, v0.app UI), ADR-004 (CustomerAccount isolation), ADR-007 (included CRM), ADR-014 (English and Spanish), OPEN-001 `SUBSCRIBER_ONLY`. No new ADR.  
**API:** `requireCrmApiActor` in `lib/platform/crm/route-auth.ts` stays the CRM HTTP gate. This contract does not replace it.

## Server interface

Import from `lib/platform/crm/page-entitlement.ts`.

```ts
resolveCrmPageEntitlement(): Promise<CrmPageEntitlement>
```

The function takes no account id. It uses the Auth.js `CustomerAccount` from `requireCustomerMembership`, then account-scoped subscription evidence from `loadSubscriberEvidenceForAccount`. A payer group is not read and does not authorize CRM.

`evaluateCrmPageEntitlement` is the pure form used by tests. It calls OPEN-001 `evaluateIncludedFreeAccessForAccount` for `core.crm`.

### `CrmPageEntitlement`

| Field | Meaning |
|---|---|
| `state` | `eligible`, `subscription_required`, or `unavailable` |
| `code` | `INCLUDED`, `FREE_SOFTWARE_NOT_ELIGIBLE`, `CRM_DISABLED`, `SUBSCRIPTION_EVIDENCE_UNAVAILABLE`, `LEGACY_EVIDENCE_AMBIGUOUS`, `POLICY_UNRESOLVED`, or `FORBIDDEN` |
| `httpStatus` | `200` only when `state` is `eligible`. `403` for subscription denial and module `FORBIDDEN`. `503` when CRM is disabled or evidence cannot be verified |
| `customerAccountId` | Session account the decision used. Not a payer-group id |
| `renderWorkspace` | `true` only when `state` is `eligible` |
| `showIncludedFreeBadge` | `true` only when `state` is `eligible` |
| `locked` | `{ en, es }` with `title` and `body`, or `null` when the workspace may render |

The object does not include subscription rows, provider ids, prices, or a membership role.

`crmPageMayExposeRecords` is true only for `eligible` / `INCLUDED`.  
`crmPageLockedCopy(entitlement, locale)` returns the English or Spanish locked copy.  
`crmPageGateForPath(pathname, entitlement)` returns that same decision for the overview and every current nested CRM path (`CRM_DASHBOARD_PAGE_PATHS`, plus a real contact id). English paths are unprefixed. Spanish paths use `/es`. A path outside that set stays closed.

### States

| Condition | `state` | `code` | Workspace |
|---|---|---|---|
| `CRM_BACKEND_ENABLED` off | `unavailable` | `CRM_DISABLED` | Hidden |
| Evidence `loadOutcome` is not `ok`, or the snapshot account is not the session account | `unavailable` | `SUBSCRIPTION_EVIDENCE_UNAVAILABLE` | Hidden |
| OPEN-001 legacy evidence is ambiguous, or policy is unresolved | `unavailable` | `LEGACY_EVIDENCE_AMBIGUOUS` or `POLICY_UNRESOLVED` | Hidden |
| Session account has qualifying website-subscription evidence | `eligible` | `INCLUDED` | Existing subscriber CRM, including the FREE badge |
| Session account has verified evidence and is not a website subscriber | `subscription_required` | `FREE_SOFTWARE_NOT_ELIGIBLE` | Hidden |

Unavailable evidence is not rendered as FREE access and is not labeled as a confirmed non-subscriber.

Locked `subscription_required` copy:

- English title: `Active website subscription required`
- English body: `Included CRM for this customer account requires an active website subscription.`
- Spanish title: `Se requiere una suscripción activa de sitio web`
- Spanish body: `El CRM incluido para esta cuenta de cliente requiere una suscripción activa de sitio web.`

## v0.app integration

Edit only v0-owned visual files. Do not change `lib/platform/**`, API routes, or this contract.

1. In `app/[locale]/dashboard/crm/layout.tsx`, `await resolveCrmPageEntitlement()` before `WorkspaceIntro`, `WorkspaceSubnav`, and `{children}`. The layout wraps every nested CRM page, so a direct visit to `/dashboard/crm/contacts` or `/es/dashboard/crm/leads/funnel` uses the same decision.
2. When `renderWorkspace` is false, render `crmPageLockedCopy` for the active locale only. Do not render the FREE / GRATIS badge, the fair-use “included free” line, the CRM subnav, child pages, or any CRM fetch.
3. When `renderWorkspace` is true, keep the current eligible CRM workspace and the existing FREE badge (`showIncludedFreeBadge`).
4. Do not send `subscription_required` through `classifyWorkspaceError` in `lib/crm-ui/workspace.ts`. That helper maps HTTP 403 to `FORBIDDEN`, whose current English body is `Your role in this account cannot do this.` Subscription denial is eligibility, not a membership role.
5. Keep public marketing prices configurable and provider-neutral. This contract does not set a price.

`components/crm/workspace-kit.tsx` `WorkspaceSubnav` already renders `next/link`. Issue #105 reports that CRM subnav clicks do not navigate while a direct URL does. The cause was not reproduced in this backend change. Investigate a click, overlay, or hydration defect only if it still reproduces after the locked state is in place. Do not replace the links with non-link controls on the basis of this report alone.

## Acceptance that remains after this contract

Staging re-check is a later owner step. This change does not migrate, activate flags, reprovision fixtures, or deploy.

- Pilot A: eligible overview and contacts, English and Spanish, with API reads allowed for that account.
- Pilot B: locked subscription copy on the overview and on a direct nested CRM URL; `GET /api/v1/crm/contacts` stays `403` with `code: FREE_SOFTWARE_NOT_ELIGIBLE`.
- No sibling-account CRM reads. Payer-group membership stays a billing relationship.
