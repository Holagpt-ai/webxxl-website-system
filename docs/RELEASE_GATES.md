# Release Gates

## Gate A — pull request

- Branch from current `main`. Respect Cursor and v0 file ownership.
- Schema or application changes: `prisma validate`, `prisma generate`, `pnpm typecheck`, the focused tests for the change, and `pnpm build`.
- Docs and continuity scripts: the Node checks below. They do not need a database or a Next.js build.
- Tenant, consent, approval, and idempotency tests when those boundaries change.
- Cite an ADR or legacy decision id, or write `ADR not required`.
- Leave the PR unmerged until the owner approves.

## ADR integrity

- Read [`docs/adr/INDEX.md`](adr/INDEX.md) and [`docs/platform/docs/15-DECISIONS-CHANGELOG.md`](platform/docs/15-DECISIONS-CHANGELOG.md).
- New records use [`docs/adr/TEMPLATE.md`](adr/TEMPLATE.md) and stay PROPOSED until the owner decides.
- APPROVED requires `approval_evidence` other than `NONE` and a decision-log update. CI checks that the field is present. CI does not decide that the owner agreed.
- Commands: `node scripts/validate-adr.mjs` and `node --test __tests__/docs/adr-validator.test.mjs`.

## Gate B — production deploy

- The approved SHA matches the Vercel production deployment record.
- Migrations are a separate action. A deploy does not imply they ran.
- No sends, charges, schedules, DNS cutovers, or publishing from the merge itself.
- Record the SHA with `scripts/check-deployment-evidence.mjs`. Do not force-push `main` from CI.

## Gate C — activation

- Owner names the environment, the flag or provider, and the scope.
- Test tenant isolation, consent, cost limits, and idempotency on real data only when that test is authorized.
- The UI must not say connected while the provider is off.

## Gate D — launch certification

Deferred. Do not start a full release audit inside an ordinary build batch.

## Automation in this repository

| Check | Workflow | When | Blocking |
|---|---|---|---|
| Docs, routes, SEO, migration folders, platform checksums, ADR validator | `.github/workflows/continuity.yml` | Every pull request and every push to `main` | Yes. This is the check to require |
| ADR validator again | `.github/workflows/adr-integrity.yml` | Only when ADR, validator, or that workflow changes | Do not also require it. A path-filtered check is skipped on other PRs, and a skipped required check blocks merge |
| `prisma validate`, `prisma generate`, `pnpm typecheck`, `pnpm build` | `.github/workflows/app-validate.yml` | Pull requests that touch the application, Prisma, or package manifests | The gate job always reports. Require `app-validate-gate` only after one green application PR. Full `pnpm test` stays in the batch, not in this workflow, until a green baseline exists |
| Branch divergence | `scripts/check-branch-divergence.mjs` inside Continuity | Every pull request | Advisory. A behind branch prints a warning and exits 0 |
| Stale open-status wording | `scripts/check-stale-operational-status.mjs` inside Continuity | Every pull request | Advisory. Prints a warning and exits 0. It uses the latest MERGED batch and PR numbers in `docs/PROJECT_MEMORY.md`. It does not compare document text to the current commit SHA |
| Deployment SHA | `.github/workflows/deployment-evidence.yml` | Manual `workflow_dispatch` only | Report artifact only. No repository write |

Recommended branch protection, for the owner to apply by hand: pull request required, Continuity required, no direct pushes, no force-push. This PR does not change repository settings. No workflow deploys, migrates, or commits to `main`.

Pull request secrets are not required. Application CI uses dummy `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` values so Prisma can generate a client. Those values are not a database.
