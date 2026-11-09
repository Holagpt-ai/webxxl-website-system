# Batch 4 — Communications & Messaging Wallet API contract

**Issue:** #109 · **ADR:** not required (composes COMMS-06, Batch 20/32/35, WALLET-09; no architecture change).

## Route

`GET /api/v1/communications/execution/summary`

### Query

| Param | Required | Description |
|---|---|---|
| `managedSiteId` | No | When set, must belong to session account or `404` |
| `customerAccountId` | No | If present, must match session account or `403` |

### Auth

- Session `requireCustomerMembership`
- Core slices: `COMMS_BACKEND_ENABLED`, OPEN-001 `core.communications`, `comms.read`
- Chatwoot readiness slice: additionally `COMMS_INTEGRATION_GATES_ENABLED`

Denied gates return per-slice `UNAVAILABLE` with `reasonCode` — the route does not 500 for disabled Chatwoot or wallet modules.

### Response

`{ summary: CommsExecutionSummaryResponse }` — see `lib/platform/comms-execution/types.ts`.

| Slice | Source (reused) | Notes |
|---|---|---|
| `inboxVisibility` | `listAccountInboxes` + conversation mapping counts | Tenant = `CustomerAccount`; billing group does **not** grant sibling access |
| `chatwootReadiness` | `buildChatwootIntegrationReadiness` | Omits secrets; dispatch remains blocked |
| `messagingProviderReadiness` | `buildMessagingProviderReadiness` | Twilio/Resend flags reported; `liveDispatchBlocked: true` |
| `walletGroupBoundary` | BillingGroup membership + `getWalletBalance` | Shared payer wallet only; `siblingCrmAccessGranted: false` |
| `outboundPolicyGates` | Comms env flags | Consent/suppression/sender enforcement lives in prepare path |
| `dispatchPolicy` | Always preparation-only | `chatwootNativeSendBlocked: true`; never authorizes live send |

### Guarded prepare (server)

`prepareGuardedCommunication` in `lib/platform/comms-execution/guarded-prepare-service.ts` (also used by `prepareCommunicationIntent` when `COMMS_INTEGRATION_GATES_ENABLED`):

1. Loads CRM consent, suppression, sender eligibility, membership, billing-group siblings, Chatwoot mapping, and quote facts server-side (`outbound-auth-loader.ts`).
2. When `crmContactId` is present, binds `recipientAddress` to that contact’s channel identity (normalized); mismatch fails closed before intent/quote/reservation.
3. Calls `authorizeOutboundCommunication` (Batch 35). Approval evidence is **DB-only** (`CommunicationApproval`); request-body booleans are ignored.
4. Persists intent with policy decision; Chatwoot native billable send remains blocked.
5. Wallet holds use `evaluateWalletHoldEligibility` (preparation eligibility distinct from dispatch-disabled). Prohibited/suppressed/unapproved intents never reserve. Optional `prepareCommsWalletReservation` while outbound stays OFF.

`reconcileCommsWalletAgainstDispatchOutcome` bridges provider lifecycle evidence to durable settle/release. Unknown outcomes stay `RECONCILIATION_REQUIRED`.

### Extended intent route

`POST /api/v1/communications/intents` accepts optional `quoteId`, `billingGroupId`, `managedSiteId`, `reserveWallet`. `humanApprovalGranted` in the body is ignored. Live SMS/email/Chatwoot dispatch remains blocked by execution gates.

### v0 Stage B handoff (Cursor does not edit these paths)

Optional communications execution panel:

- **Paths:** `app/[locale]/dashboard/communications/**`, `components/communications/**` (v0-owned).
- **Fetch:** `GET /api/v1/communications/execution/summary?managedSiteId=`
- **UI:** render each slice when `status === 'AVAILABLE'`; show `reasonCode` + `message` otherwise; never imply live send from `PREPARED` / readiness state; keep EN/ES copy; surface wallet group note that sibling CRM is not shared.

### Runtime gates (unchanged)

No live Chatwoot/Twilio/Resend activation, SMS/email sends, wallet funding charges, production migrations, or flag activation in this batch.
