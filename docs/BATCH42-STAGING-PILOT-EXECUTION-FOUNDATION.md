# Batch 42 — Staging pilot execution foundation

**Status:** IN PR (implementation; no live staging writes in Cursor session)  
**Depends on:** Batch 41 merged @ `9d32717` (PR #102)  
**ADR:** Not required — extends Batch 41 dry-run planner with guarded apply path.

## Scope

Operator-controlled staging fixture provisioning for PILOT-21B accounts:

| Account | Id | Entitlement |
|---|---|---|
| A (EN) | `acct_pilot_staging_a` | ACTIVE `website.subscription` on same account |
| B (ES) | `acct_pilot_staging_b` | Membership only — no subscriber row |

## Commands

| Command | Behavior |
|---|---|
| `pnpm pilot:staging-fixture-plan` | Batch 41 deterministic plan (dry-run, no DB) |
| `pnpm pilot:staging-fixture-provision` | Default **dry-run**; inspects staging when `DATABASE_URL` is bound |
| `pnpm pilot:staging-fixture-provision --apply --confirm-staging-provision` | Apply gate (requires owner env + staging preflight) |

## Apply gates (all required)

1. `DATABASE_URL` / `DIRECT_URL` → allowlisted staging ref `vcgibefnhneaqhcguhnt` only.
2. `WEBXXL_STAGING_DATABASE_IDENTITY` matches connection fingerprint.
3. Production ref `txfxeehglqfszletuumn` **always refused**, even with confirmation.
4. `WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1` (apply only).
5. `WEBXXL_STAGING_PILOT_FIXTURE_APPLY_AUTHORIZED=1` (separate owner authorization).
6. CLI `--confirm-staging-provision` with `--apply`.

## Safety

- No destructive reset; idempotent creates only when rows missing.
- No passwords, OAuth tokens, or provider activation in repo.
- User rows only — Auth.js login remains owner-configured on preview (`AUTH_URL`).

## Operator checklist

See `lib/platform/pilot/staging-pilot-operator-checklist.ts` (printed by provision CLI).

## Tests

- `__tests__/platform/batch42-staging-pilot-fixture-provision.test.ts`
