# Batch 11 — v0.app Marketing list handoff (Cursor-owned backend only)

## Consume from backend

| Endpoint | Use |
|---|---|
| `GET /api/v1/marketing/artifacts` | Account-wide deliverables list (replace per-request fan-out where still used) |
| `GET /api/v1/marketing/reviews` | Approval inbox; honor `effectiveStatus` and `allowedActions.canDecide` |
| Row `destination.path` | Locale-neutral link; prefix `/es` for Spanish |
| `navigation` object | Workspace shortcuts (requests / deliverables / approvals) |
| `GET /api/v1/portal/dashboard-context` | `crossModule.marketingWorkspaces` for shell/module chrome |

## v0-owned paths

`app/[locale]/dashboard/marketing/deliverables/**`, `approvals/**`, `components/marketing-studio/**`, `lib/marketing-studio-ui/**`.

## Verification (v0)

- EN + ES list pages render honest empty/disabled states when `MKT_DISABLED` or `POLICY_UNRESOLVED`.
- Pending review rows link via `destination.path`.
- List `nextCursor` pagination round-trips without inventing totals.