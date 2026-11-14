# Batch 9B — v0.app visual handoff (optional)

Cursor completed backend routes, Business Overview destinations, and minimal query-focus integration. v0.app may polish **visual** emphasis only — do not edit backend or `lib/platform/**` paths.

| Surface | Route | v0 scope |
|--------|--------|----------|
| Project hub | `/dashboard/project` | Highlight dependency/milestone when `dependencyId` or `milestoneId` query is set |
| Approvals | `/dashboard/approvals` | Highlight pending approval card when `approvalId` query is set |
| Files | `/dashboard/files` | Highlight uploaded file row when `fileId` query is set |
| Messages | `/dashboard/messages` | Highlight thread comment when `commentId` query is set |
| Requests | `/dashboard/requests` | Highlight change request when `requestId` query is set |
| Support | `/dashboard/support` | Highlight ticket when `ticketId` query is set |
| Marketing approvals | `/dashboard/marketing/approvals` | Highlight review card when `reviewId` query is set |
| CRM leads | `/dashboard/crm/leads` | (9A) Optional focus ring on selected lead detail panel |

Preserve EN/ES copy in existing dictionary files; no new product strings required for focus states unless adding aria-live announcements.