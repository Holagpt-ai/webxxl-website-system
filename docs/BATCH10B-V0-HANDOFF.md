# Batch 10B — v0.app visual handoff (Cursor-owned backend only)

## Backend delivered (Cursor)

- `GET /api/v1/portal/dashboard-context` — module handoffs + active project/site selection.
- `PORTAL_DASHBOARD_API.context` in `lib/dashboard-ui/types.ts`.
- `switchManagedSiteAction` in `lib/portal/customer-actions.ts` (wire a site switcher when product-ready).
- Account switch clears stale project/site cookies and revalidates dashboard layouts.

## Suggested UI integration (v0-owned paths only)

| Path | Suggestion |
|---|---|
| `components/dashboard/shell.tsx` | Optional: prefetch dashboard context on layout mount; compare `context.customerAccountId` to `activeAccountId` and remount children on mismatch (same pattern as Business Command Center). |
| `components/dashboard/account-switcher.tsx` | No change required; server action already clears cross-account selection cookies. |
| Module deep links | Use `context.modules[].workspace.path` (locale-neutral); prefix `/es` for Spanish. |

## Do not edit (Cursor-owned)

- `lib/portal/**`, `lib/platform/customer-dashboard/**`, `app/api/v1/portal/**`
- Business Command Center APIs and composers

## Verification evidence (v0)

- List every edited path.
- Confirm EN and ES dashboard routes resolve for at least one `available` and one `disabled` module snapshot (screenshots optional).