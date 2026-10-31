# Batch 32 — Commerce, Shared Wallet & Fulfillment Integrity V1

**Scope:** Extend COMMERCE-11/12 and WALLET-09 foundations without a replacement billing platform.

## Delivered

| Workstream | Implementation |
|---|---|
| WS1 Lifecycle | `cancelUnpaidOrder`, subscription activation on initial verified capture, refund compensating-review audit |
| WS2 Boundaries | `lib/platform/commerce/financial-boundaries.ts` — money vs wallet credits vs included FREE |
| WS3 Wallet | `lib/platform/wallet/reservation-reconciliation.ts` — open-hold review list |
| WS5 Reconciliation | `lib/platform/commerce/reconciliation-report.ts` + admin GET route |
| WS6 Tests | `__tests__/platform/batch32-commerce-wallet-integrity.test.ts` |

## Owner decisions still unresolved

- Subscription grace after `PAST_DUE`
- Tax, refund, and chargeback policy
- Live payment processor selection and activation
- Wallet mint and top-up activation in production

## Batch 32.1 (same PR #83)

| Fix | Detail |
|---|---|
| F1 Atomic cancel | Store `atomicCancelUnpaidOrder` CAS/transaction; fail-closed when provider checkout ref exists; late verified capture retained (`LATE_CAPTURE_AFTER_CANCEL`) |
| F2 Bounded reconciliation | Paginated order bundle load; `scanCoverage` + `groupReconciliationComplete`; no unbounded group order reads |

## Boundaries (unchanged)

No production migrations, live checkout, real charges, webhook activation, wallet mint activation, or external provisioning in this batch.
