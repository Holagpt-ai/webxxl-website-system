# COMMERCE-12 — Customer & Admin Marketplace API Contract (v0)

**Audience:** v0.app dashboard integration. **Backend flags default off.** No live checkout, minting, or webhooks.

## Authentication

All routes require an authenticated Auth.js session (`requireUser` or `requireStaff`).

| Role | Access |
|------|--------|
| Customer portal user | Operating membership on `customerAccountId`, or billing-group role |
| Staff / Admin | Admin catalog, activation, all read scopes |

## Global disabled state

When `COMMERCE_BACKEND_ENABLED` is not set:

```json
{ "code": "COMMERCE_DISABLED", "message": "Commerce backend is disabled" }
```

HTTP **503**.

Wallet reads additionally require `WALLET_BACKEND_ENABLED` and (for customers) `WALLET_GROUP_READ_ENABLED`. Wallet summary returns null balances with `readDisabledReason` instead of failing the commerce route.

## Pagination

Query parameters on list endpoints:

| Param | Default | Max |
|-------|---------|-----|
| `take` | 25 | 100 |
| `skip` | 0 | — |

Response envelope:

```json
{
  "items": [],
  "pagination": { "take": 25, "skip": 0, "total": 0, "hasMore": false }
}
```

## Customer — purchase history

`GET /api/v1/commerce/accounts/{accountId}/orders`

Query: `billingGroupId?`, `take`, `skip`

**Auth:** Operating membership on `accountId`, or staff.

**Item shape (`PurchaseHistoryOrderDto`):** financial order fields from COMMERCE-11 plus `createdAt`, `updatedAt`, `legacyMarketplace` (nullable link to `ServiceOrder`), `checkoutEnabled: false`, `paymentConfirmed` (true when order reached paid/fulfillment terminal path).

## Customer — billing group orders (payer view)

`GET /api/v1/commerce/billing-groups/{id}/orders`

Query: `customerAccountId?`, `take`, `skip`

**Auth:** `GROUP_OWNER`, `BILLING_ADMIN`, `BILLING_VIEWER`, staff, or operating member with active funding membership in the group.

## Customer — billing group summary

`GET /api/v1/commerce/billing-groups/{id}/summary`

Returns group profile, caller role, **member accounts visible to caller** (id, businessName, slug, funding status only — no CRM/contacts), and feature flags (`commerceBackendEnabled`, `walletBackendEnabled`, `walletGroupReadEnabled`, `checkoutEnabled: false`).

Operating members without a billing role see **only their own** member row(s).

## Customer — wallet summary

`GET /api/v1/commerce/billing-groups/{id}/wallet-summary`

**Auth:** Billing-group role or staff (operating-only members receive **403**).

```json
{
  "billingGroupId": "...",
  "walletId": "...",
  "creditType": "MESSAGING",
  "unit": "CREDITS",
  "postedBalance": 1000,
  "reservedBalance": 50,
  "availableBalance": 950,
  "walletBackendEnabled": false,
  "walletGroupReadEnabled": false,
  "readDisabledReason": "WALLET_DISABLED"
}
```

## Customer — legacy marketplace requests

`GET /api/v1/commerce/accounts/{accountId}/marketplace-requests`

Paginated `ServiceOrder` rows with optional `commerceOrder` link when a `CommerceOrder.serviceOrderId` exists. Does not duplicate financial totals from commerce orders.

## Admin — catalog read

`GET /api/v1/admin/commerce/catalog`

Staff only. All products and prices (including draft/inactive).

## Admin — activation (no checkout)

`POST /api/v1/admin/commerce/products/{productKey}/activation`

Body: `{ "status": "ACTIVE" | "INACTIVE" | "DRAFT" }`

`POST /api/v1/admin/commerce/prices/{priceId}/activation`

Body: `{ "status": "ACTIVE" | "INACTIVE" }`

OPEN-001 protected products (`INCLUDED_FREE`, `UNRESOLVED` cohort, AI workforce) cannot be activated to **ACTIVE** on prices; product activation to ACTIVE is blocked for the same policy set.

Does not enable `COMMERCE_CHECKOUT_ENABLED` or any payment processor.

## Admin — reconciliation report (read-only)

`GET /api/v1/admin/commerce/reconciliation-report?billingGroupId={id}&limit=50`

**Auth:** Staff, or `GROUP_OWNER` / `BILLING_ADMIN` on the billing group (not `BILLING_VIEWER` alone).

**Response:** Bounded report (`findingsLimit`, default 50) with explicit `scanCoverage` (orders/funding/webhooks scanned vs in-group totals and per-dimension limits). `groupReconciliationComplete` is `false` when any scan is partial or findings were truncated — not a claim of full group-wide reconciliation. Finding categories: paid without fulfillment, fulfillment without captured payment, funding without ledger, webhook review, subscription/order mismatch, compensating refund review. `activation.correctiveMutationsEnabled` is always `false`.

Does not enable webhooks, minting, checkout, or wallet corrective mutations.

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `COMMERCE_DISABLED` | 503 | Commerce backend off |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Tenant or role denied |
| `POLICY_UNRESOLVED` | 403 | OPEN-001 / included SKU |
| `VALIDATION` | 400 | Bad input |
| `PRICE_UNAVAILABLE` | 404 | Missing product/price |
| `ACCOUNT_NOT_FUNDED` | 403/409 | Inactive billing group |

## Existing COMMERCE-11 routes (unchanged)

Catalog browse, quotes, order create, checkout, webhooks remain gated separately; v0 should not surface checkout until product enables flags explicitly.
