# Shared boundaries — all Cursor Cloud Workforce roles

Read root [`AGENTS.md`](../../AGENTS.md) first. These rules apply to every role in [`docs/cursor-cloud-workforce/`](README.md).

## Tool and platform ownership

| Owner | Permitted surfaces (default) | Prohibited without integration PR + named paths |
|---|---|---|
| **Cursor** | `app/api/**`, `lib/**`, `prisma/**`, `scripts/**`, `__tests__/**`, `config/**`, `.github/**`, `docs/**`, `.cursor/**`, `infra/**` (non-UI) | `components/**`, `app/**/page.tsx` and layout/styling owned by v0 customer/admin/public UI |
| **v0.app** | Customer/admin/public UI: `app/[locale]/**` pages, `components/**`, visual `lib/*-ui/**` per batch contract | Backend, Prisma, continuity docs, CI, workforce libraries |

Integration PRs must list **exact paths** on both sides before parallel work.

## Universal prohibitions (all roles)

- Production or staging **database** access, `pnpm db:migrate`, or migration apply.
- **Merge** pull requests, **deploy**, DNS cutover, Vercel cron enablement, or `deploy.production`.
- Turn **feature flags ON**, connect **providers**, store **secrets** in git, or run **LLM / Paperclip / AUTO-10 live execution**.
- **Live** SMS, email broadcast, social publish, voice, billing charges, or wallet debits.
- **Cross-tenant** data access; raw SQL; unrestricted provider keys; PHI processing.
- **Spawn** additional cloud agents or automations unless the owner prompt explicitly delegates and names the child role.

## Delegation (V1)

| From | May delegate to | How |
|---|---|---|
| Owner / Coordinator | Any single role | One prompt, one role file, one bounded outcome |
| Project Manager | None by default | PM proposes assignments; owner starts Engineer/QA/Docs/Ops runs |
| Engineer | QA (verification only) | Hand off branch name, changed paths, and test plan in `SESSION_HANDOFF` — owner starts QA agent |
| QA | Engineer (fixes) | File defects; owner starts Engineer with issue ID |
| Documentation | None | Docs PRs only; no code fixes |
| Operations | Documentation | Request doc updates via handoff text; owner starts Documentation agent |

No recurring schedules or automatic handoffs in V1.

## Mandatory owner approvals (Tier 3+)

Separate explicit owner authorization required before any role assists with:

- Production or isolated-staging **migration apply**
- Any **`CUSTOMER_AI_*` / workforce / analytics / comms / marketing execution flag** enabled in a target environment
- **Provider credentials**, OAuth connect, webhooks to production, or live outbound communications
- **Architecture/vendor** changes requiring ADR-018+ approval or legacy decision amendment
- **DNS**, public site publish, or pricing/commercial policy changes

## Focused validation (prefer over full audits)

When the assignment touches docs only:

```bash
node scripts/validate-continuity.mjs
node scripts/validate-adr.mjs
node --test __tests__/docs/*.test.mjs
```

When the assignment touches routes or generated artifacts, add the matching validators from [`README.md`](../../README.md).

When the assignment touches TypeScript source:

```bash
pnpm typecheck
pnpm test -- <focused glob or test name>
```

Do not run `pnpm build` or migrations unless the assignment explicitly requires it and environment is non-production.

## Handoff block (end of every run)

```
Role: <PM|Engineer|QA|Documentation|Operations>
Assignment: <one-line scope>
Repo / base main SHA: Holagpt-ai/webxxl-website-system / <sha>
Branch / PR / head: <branch> / <PR or none> / <head sha>
Merged / deployed: <honest state — open PR is not merged>
Migration / flags / activation: UNVERIFIED or unchanged unless evidenced
Validations run: <commands + result>
Next exact assignment / owning tool: <who + what>
Do NOT touch: <owner prohibitions for follow-up>
PENDING REPOSITORY SYNC: <none | fact + target file + platform>
```

Update [`docs/PROJECT_MEMORY.md`](../PROJECT_MEMORY.md) and [`docs/SESSION_HANDOFF.md`](../SESSION_HANDOFF.md) **together** when checkpoint facts change (typically Documentation or Engineer on a merged batch).

## Cost and scope controls

- One cohesive PR per batch; avoid drive-by refactors.
- No repository-wide search-and-replace or dependency upgrades unless assigned.
- Prefer reading `docs/PROJECT_MEMORY.md` checkpoint over re-auditing the full TAD.
- Cloud agent runs should use the saved **WebXXL Cloud Development** environment; do not create duplicate Hostinger/VPS resources in V1.
