# WebXXL — Website & Business Operations Platform

**Repository:** [`Holagpt-ai/webxxl-website-system`](https://github.com/Holagpt-ai/webxxl-website-system) · **Primary branch:** `main` · **Product:** WebXXL · **Portal reference:** `https://www.webbxxl.com` (double `b`) · **Reconciled:** 2026-10-25.

WebXXL is a modular, multi-tenant managed-website and business-operations platform. Source on `main` is not the same thing as an enabled provider, an applied migration, or a verified customer workflow.

## First read

1. [`AGENTS.md`](AGENTS.md) — who edits what, and what a session must not assume.
2. [`docs/PROJECT_MEMORY.md`](docs/PROJECT_MEMORY.md) — current decisions and source checkpoint.
3. [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md) — latest batch, evidence, and next assignment.
4. [`docs/platform/docs/00-SESSION-START.md`](docs/platform/docs/00-SESSION-START.md) and [`docs/platform/docs/01-MASTER-TAD.md`](docs/platform/docs/01-MASTER-TAD.md) — approved target architecture. Do not replace that Master TAD.

## Operational index

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — short system map.
- [`docs/ROUTE_MAP.md`](docs/ROUTE_MAP.md) — route families and the navigation check.
- [`docs/DATA_AND_SERVICES.md`](docs/DATA_AND_SERVICES.md) — data custody, adapters, workers, flags.
- [`docs/DEPLOYMENT_STATUS.md`](docs/DEPLOYMENT_STATUS.md) — deploy SHA, migrations, and activation kept apart.
- [`docs/ISSUE_REGISTER.md`](docs/ISSUE_REGISTER.md) — open defects, deferrals, and blockers.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — merged source milestones.
- [`docs/RELEASE_GATES.md`](docs/RELEASE_GATES.md) — PR, deploy, and activation gates.
- [`docs/CHATGPT_PROJECT_INSTRUCTIONS.md`](docs/CHATGPT_PROJECT_INSTRUCTIONS.md) — copyable ChatGPT project instructions.
- [`docs/adr/INDEX.md`](docs/adr/INDEX.md) and [`docs/adr/README.md`](docs/adr/README.md) — ADR-018+ registry. ADR-001 through ADR-017 stay in the Master TAD decision log.

## Technical quick start

Next.js App Router 16.3.3, React 19, TypeScript, Prisma 6.19.3, Auth.js (NextAuth), PostgreSQL/Supabase. `package.json` declares `pnpm@12.3.4`.

```bash
pnpm install
pnpm exec prisma generate
pnpm dev
```

Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for the change in front of you. `pnpm db:migrate` writes to a database. Do not run it against production without a separate owner authorization. Secrets belong in the environment store. `.env.example` documents names only.

Continuity checks (no install):

```bash
node scripts/validate-continuity.mjs
node scripts/validate-adr.mjs
node scripts/validate-routes.mjs
node scripts/validate-seo.mjs
node scripts/validate-generated.mjs
node --test __tests__/docs/*.test.mjs
```

## Delivery control

Cursor owns backend, data, APIs, migrations, docs, CI, Git, and deployment logic. v0.app owns visual UI/UX. Do not edit the same files from both tools unless the assignment explicitly says it is an integration PR. GitHub is the source repository. Vercel hosts the WebXXL application. Every nontrivial change goes branch, focused tests, pull request, owner review. Do not merge from an agent session unless the owner asked for the merge.
