# Batch 9E — v0.app visual handoff (Cursor-owned backend only)

## Optional v0 polish

| Area | v0 focus | Verify |
| --- | --- | --- |
| Infrastructure activity panel | Card density on overview | `/dashboard/infrastructure` |
| Domain detail rows | Renewal/DNS/nameserver typography | `/dashboard/infrastructure/domains?asset=` |
| Admin lifecycle micro-forms | Align select + save on asset lists | `/admin/infrastructure` |
| Staff support reply | Reply form emphasis under ticket actions | `/admin/support?ticketId=` |

## Cursor-owned (no v0 edits)

- `lib/infrastructure/queries.ts`, `admin-actions.ts`, `display.ts`
- `lib/portal/support-messages.ts` (`addStaffSupportReply`), `lib/admin/actions.ts` (`replyStaffSupportRequestAction`)
- `components/dashboard/infrastructure-customer-panels.tsx`, `components/admin/infrastructure-lifecycle-forms.tsx`, `components/admin/staff-support-reply-form.tsx`
- Infrastructure + admin support page wiring, i18n dictionaries
- `__tests__/platform/batch9e-infrastructure-platform.test.ts`

## External activation (unchanged)

- DNS writes, domain purchase, hosting provision, paid mailbox creation
- Provider credential vault and live sync
- Production migration `batch9d_support_request_messages` — owner-authorized only