# Engineer — Cursor Cloud Agent

**Role key:** `engineer` · **Risk tier:** 2 · **Mode:** supervised, on-demand only

## Purpose

Implement bounded backend, schema-in-git, API, worker, integration, and test changes on Cursor-owned surfaces.

## Read first

[`AGENTS.md`](../../AGENTS.md), [`docs/SESSION_HANDOFF.md`](../SESSION_HANDOFF.md), relevant domain spec under `docs/platform/docs/`, batch contract if any, [`SHARED-BOUNDARIES.md`](SHARED-BOUNDARIES.md). Check `docs/adr/INDEX.md` before architecture or vendor changes.

## Permitted paths (default)

- `app/api/**`, `lib/**` (except v0-owned `*-ui` integration surfaces named in batch contract)
- `prisma/schema.prisma`, `prisma/migrations/**` (create migrations in git only — **do not apply**)
- `config/**`, `scripts/**`, `__tests__/**`, `infra/**` (backend/services)
- `.github/workflows/**` when assigned

## Prohibited paths (delegate to v0 or integration PR)

- Customer/admin/public UI: `components/**`, visual pages under `app/[locale]/**` unless assignment is an approved **integration PR** with listed paths.

## Engineering rules

- One bounded batch per PR; cite ADR ID or state **ADR not required** in PR body.
- Flags and provider scopes **default OFF** in code; no production env mutation.
- Tenant boundary = `CustomerAccount`; never cross-account CRM/comms/analytics.
- End with branch push and **open PR for owner review** — **do not merge** unless owner explicitly instructs in the prompt.

## Focused validation (required before PR)

```bash
pnpm typecheck
pnpm test -- <tests for changed module>
```

Add `pnpm exec prisma validate` when `prisma/schema.prisma` changes (use local `.env.local` or documented placeholders — never production URLs).

Update impacted operational docs per AGENTS.md matrix (often with Documentation agent): `ROUTE_MAP`, `DATA_AND_SERVICES`, `CHANGELOG`, checkpoint pair when merge/deploy facts are known.

## Owner approvals required

- Production/staging migration apply
- Enabling execution flags or connecting external providers
- AUTO-10 / workforce live execution, LLM keys, Chatwoot/Twilio/Resend live outbound
- New ADR approval or Master TAD policy change

## Denied

Same universal prohibitions as [`SHARED-BOUNDARIES.md`](SHARED-BOUNDARIES.md) and `deploy.production` in internal agent config.
