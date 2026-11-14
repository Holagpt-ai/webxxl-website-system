# Batch 9C — v0.app visual handoff (Cursor-owned backend only)

Cursor implemented functional wiring for Batch 9C. **Do not edit** the files listed under Cursor ownership below.

## Optional v0 polish (visual only)

| Area | Suggested v0 focus | Read-only verification |
| --- | --- | --- |
| Communications reply prep | Spacing/hierarchy for `ConversationReplyPrep` sections on conversation detail | `/dashboard/communications/conversations/:id` |
| SEO opportunities focus | Highlight ring when `?opportunityId=` is present | `/dashboard/seo/opportunities?site=&opportunityId=` |
| Analytics | Tab bar and UTC disclosure line styling | `/dashboard/analytics?tab=overview&range=28` |
| AI Employees pilot | Pilot panel layout in employee sheet | `/dashboard/ai-employees?employeeId=` |
| Social schedule prep | `GapNotice` for `?prepare=schedule` on campaign detail | `/dashboard/marketing/campaigns/:id?prepare=schedule` |

## Cursor-owned paths (no v0 overlap)

- `lib/platform/comms/conversation-reply-service.ts`
- `app/api/v1/communications/conversations/[id]/reply-preparation/route.ts`
- `app/api/v1/customer-ai/accounts/[accountId]/pilot-tasks/[taskId]/route.ts`
- `lib/platform/business-overview/destinations.ts`, `service.ts`
- `lib/analytics-ui/deep-link.ts`
- `components/communications/conversation-reply-prep.tsx`
- `components/ai-employees/pilot-tasks-panel.tsx`
- `__tests__/platform/batch9c-comms-seo-analytics-workforce.test.ts`

## External activation (not in this PR)

- Outbound comms delivery, Chatwoot live send
- Customer AI pilot HTTP flags + durable persistence migration
- Social publish/schedule provider activation
- Analytics ingestion jobs in production