# Final UI/UX — remaining v0.app scope

**Branch:** `v0/final-ui-ux-completion`  
**Base `main`:** `b26dc0b6490709a76b5721e3e689d70cc0d195d5` (PR **#139** / Batch 9E merged)  
**v0 commits (in branch):** `c88244e` (focus highlight, analytics tabs, ledger density), `b4f6a01` (public/portal mobile wrapping, tap targets)  
**Status:** **v0 source delivery reported 2026-11-18 at `84dc32f`; VISUAL QA PENDING** — not ready for owner merge  
**Verification:** No authenticated desktop/mobile browser pass yet; v0 typecheck and 24 focused Batch 9 tests reported PASS, GitHub Continuity/App Validate/Vercel PASS on `84dc32f`  
**Activation:** No production publishing, provider activation, DNS, or migrations

## Do not edit (Cursor-owned — see BATCH9C/9D/9E handoffs)

- `lib/**`, `app/api/**`, `prisma/**`, server actions in `lib/admin/actions.ts`, `lib/portal/actions.ts`, `lib/infrastructure/**` (except purely presentational props already wired)
- `components/communications/conversation-reply-prep.tsx`, `components/ai-employees/pilot-tasks-panel.tsx`
- `components/commerce/product-purchase-flow.tsx`, `order-detail-panel.tsx` **logic** (presentation/layout OK if no API contract change)
- `components/dashboard/support-ticket-thread.tsx`, `components/admin/staff-support-reply-form.tsx` **behavior**
- `lib/infrastructure/lifecycle-*.ts`, `__tests__/platform/batch9*.test.ts`, `__tests__/infrastructure/batch9e-lifecycle-mutations.test.ts`

## Remaining visual work (v0)

### Customer portal

- Files, messages, support threads, approvals — density, empty/loading/error, mobile stacking
- Checkout preparation and order-detail **presentation** (`components/commerce/*` layout only)
- Hosting, domains, email, infrastructure panels (`infrastructure-customer-panels`, overview cards)

### Product modules

- Communications — empty/loading/error (`components/communications/**`)
- Local SEO — empty/loading/error under `components/local-seo/`
- AI Employees — empty/loading/error (`components/ai-employees/**` except pilot panel logic)

### Admin

- Infrastructure lifecycle micro-forms feedback layout (`infrastructure-lifecycle-forms.tsx` — visual only)
- Staff support reply form spacing (`staff-support-reply-form.tsx` — visual only)

### Responsive / public

- Remaining mobile layout issues across portal shell, tables, pagination (extend patterns in `c88244e` / `b4f6a01`)

## Latest v0 delivery (2026-11-18, unverified visually)

- `84dc32f`: seven-file UI-only wrapping/overflow and order layout pass; no backend contracts or state changes. See `docs/PROJECT_MEMORY.md` and `docs/SESSION_HANDOFF.md` for exact file list.
- The previous checklist is the **coverage target** for a single authenticated desktop/mobile acceptance pass; it is not evidence that every surface has been tested or approved.
- Cursor owns the next review. v0 should change only demonstrated visual defects from that review, on this same branch/PR.

## After v0 completes

Cursor: one consolidated desktop + mobile visual verification, focused corrections, remove DRAFT label for owner review (still no auto-merge).