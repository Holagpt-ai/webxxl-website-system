# Batch 29 launch prerequisites (WebXXL + ABMED handoff)

Technical batch 28 completes independent engineering; **Batch 29** is formal launch authorization.

## WebXXL — customer delivery

- [ ] Latest ABMED deployment registered and **current** (`scripts/batch28-register-abmed-preview.ts` after catalog update).
- [ ] New version has its own **PENDING** approval; historical versions (`6499749`, `394a5d8`, `fc919f5`) unchanged.
- [ ] Customer revision/messaging/upload acceptance on ABMED project (authorized test account only).
- [ ] `RESEND_API_KEY` + verified `AUTH_FROM_EMAIL` domain for portal magic links.
- [ ] Invitation delivery verified (not just membership saved).

## ABMED website

- [ ] `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (verified sender), `CONTACT_TO_EMAIL=info@abmedclinicalresearch.com`.
- [ ] End-to-end contact form delivery verified to inbox (not HTTP 503 / `not_configured`).
- [ ] AI Concierge production smoke (EN/ES) on current deployment.
- [ ] Privacy draft **legal approval** (`lib/privacy-content.ts` — still marked draft).
- [ ] Owner media checklist (`lib/owner-approval-checklist.ts`).
- [ ] **`SITE_INDEXING` remains disabled** until domain cutover authorization.

## Dual authorization (see ABMED `docs/webxxl-launch-authorization.md`)

1. Website **version approval** (immutable deployment).
2. **Domain migration authorization** (WordPress replacement) — separate.

## Merge / deploy order

1. Merge WebXXL PR (catalog + registration script) → production deploy.
2. Run `batch28-register-abmed-preview.ts` against production database.
3. Merge ABMED PR if any release docs/tests only → confirm Vercel production matches `b05e0a6` or newer.
4. Customer review in portal → then Batch 29 cutover checklist (`docs/domain-migration-runbook.md` on ABMED repo).
