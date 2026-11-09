# Batch 5 — Commerce & Managed Services API contract

**Issue:** #109 · **ADR:** not required (composes COMMERCE-11/12, Batch 32, INFRA registry, WALLET-09; no architecture change).

## Delta (merged vs Batch 5)

| Area | Already on `main` | Batch 5 addition |
|---|---|---|
| Commerce engine / portal APIs | Catalog, quotes, orders, checkout, webhooks, subscriptions, billing-group summary | Unified **execution summary** composition |
| Wallet / money boundary | `financial-boundaries.ts`, Batch 32 integrity | Explicit wallet instrument slice in summary |
| Payment providers | Provider-neutral stubs; flags OFF | Payment readiness slice (never selects a live processor) |
| Hosting / domain / email | Prisma models + admin/customer registry | Honest lifecycle mapper + summary composition; no fake ACTIVE |
| Catalog | Hosting, domain, subscription, credits, included FREE | Adds `email.business` skeleton (ADDON, money, pass-through) |

Runtime gates remain OFF. Live checkout, provisioning, DNS, mailbox creation, and wallet mint are **not** activated.

## Route

`GET /api/v1/commerce/execution/summary`

### Query

| Param | Required | Description |
|---|---|---|
| `managedSiteId` | No | When set, must belong to session account or `404` |
| `customerAccountId` | No | If present, must match session account or `403` |
| `billingGroupId` | No | Preferred authorized BillingGroup when the account has multiple memberships |

### Auth

- Session `requireCustomerMembership`
- Core commerce slices require `COMMERCE_BACKEND_ENABLED`
- Denied / disabled gates return per-slice `UNAVAILABLE` with `reasonCode`

### Response

`{ summary: CommerceExecutionSummaryResponse }` — see `lib/platform/commerce-execution/types.ts`.

| Slice | Source (reused) | Notes |
|---|---|---|
| `catalogEntitlements` | `COMMERCE_CATALOG_SKELETON` + `classifyFinancialInstrument` | OPEN-001 `SUBSCRIBER_ONLY`; included FREE not payable |
| `purchaseHistory` | `listOrdersByAccount` + order items | Tenant = `CustomerAccount`; BillingGroup does **not** share sibling purchase visibility |
| `billingGroupPayer` | Billing roles + funding memberships | Authorized shared payer (ABMED pattern); operational isolation constant |
| `walletInstrumentBoundary` | Wallet balance (optional) | Messaging credits never debit for money hosting/domain/subscription/email |
| `paymentProviderReadiness` | `config/commerce-backend` + `resolveCommerceProviderKey` | `liveChargeBlocked: true`; provider-neutral |
| `managedServicesLifecycle` | Project services + infra overview + lifecycle mapper | ACTIVE only with `PROVIDER_VERIFIED` + external ref |
| `subscriptionState` | Subscriptions by order | Provider subscription calls reported blocked when flag off |
| `invoiceReferences` | Invoices by order | WebXXL invoice refs; external refs need verified events |
| `fulfillmentPolicy` | Constants | Payment evidence required; duplicates rejected; historical snapshots preserved |

### Managed service lifecycle honesty

Internal states: `REQUESTED`, `QUOTED`, `PENDING_APPROVAL`, `PENDING_PAYMENT`, `READY_FOR_PROVISIONING`, `ACTIVE`, `FAILED`, `CANCELLED`.

Owning a WebXXL service/infra row is **not** provider activation. `ACTIVE` requires verified provider evidence.

### v0 Stage B handoff (Cursor does not edit these paths)

Optional commerce / infrastructure panels:

- **Paths:** `app/[locale]/dashboard/commerce/**`, `app/[locale]/dashboard/infrastructure/**`, related v0-owned components.
- **Fetch:** `GET /api/v1/commerce/execution/summary?managedSiteId=&billingGroupId=`
- **UI:** render each slice when `status === 'AVAILABLE'`; show `reasonCode` + `message` otherwise; never imply live charge or provider ACTIVE from readiness / READY_FOR_PROVISIONING; keep EN/ES; surface BillingGroup isolation note.

### Runtime gates (unchanged)

No live Stripe/Paddle/Lemon Squeezy charging, domain registration, DNS cutover, hosting provisioning, mailbox creation, wallet mint, production migrations, or flag activation in this batch.
