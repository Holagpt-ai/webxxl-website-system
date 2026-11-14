# Batch 9D — v0.app visual handoff (Cursor-owned backend only)

## Optional v0 polish

| Area | v0 focus | Verify |
| --- | --- | --- |
| Marketplace purchase cards | Spacing for `ProductPurchaseFlow` on catalog tiles | `/dashboard/marketplace` |
| Order detail panel | Sheet vs inline panel styling | Select order → detail panel |
| Billing ledger table | Table density for credit ledger rows | `/dashboard/billing` (billing role) |
| Support thread | Reply form emphasis on `WAITING_ON_CUSTOMER` | `/dashboard/support?ticketId=` |

## Cursor-owned (no v0 edits)

- `prisma/schema.prisma` + `prisma/migrations/20261114143000_batch9d_support_request_messages/`
- `lib/portal/support-messages.ts`, `lib/portal/actions.ts` (`replySupportRequestAction`)
- `lib/commerce-ui/api.ts`, `components/commerce/product-purchase-flow.tsx`, `order-detail-panel.tsx`
- `components/dashboard/support-ticket-thread.tsx`
- `__tests__/platform/batch9d-commerce-support-portal.test.ts`

## External activation (unchanged)

- Live payment capture / checkout providers
- Wallet funding mint in production
- DNS / domain purchase / hosting provision automation
- Migration apply on production (`batch9d_support_request_messages`) — owner-authorized only