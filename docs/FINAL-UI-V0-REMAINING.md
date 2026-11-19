# Final UI/UX — remaining v0.app scope

**Branch:** `v0/final-ui-ux-completion`  
**Base `main`:** `b26dc0b6490709a76b5721e3e689d70cc0d195d5` (PR **#139** / Batch 9E merged)  
**v0 commits (in branch):** `c88244e` (focus highlight, analytics tabs, ledger density), `b4f6a01` (public/portal mobile wrapping, tap targets)  
**Status:** Integrated with `main` `623a9e9`; **prepared for owner merge review** (not merged).  
**PR head:** `44463bc169721485b8d51a2ff566ee5137da669b` (includes v0 `84dc32f` + legal #141/#142 via merge).  
**Verification:** Authenticated portal/admin UI **DEFERRED** to release stabilization — **not verified**. Public-only spot checks recorded earlier; not a pass on signed-in modules.  
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

## Latest v0 delivery (2026-11-18)

- `84dc32f`: seven-file UI-only wrapping/overflow and order layout pass; no backend contracts or state changes. See `docs/PROJECT_MEMORY.md` and `docs/SESSION_HANDOFF.md` for exact file list.
- The checklist above remains the coverage target. It is not evidence that those surfaces passed.

## 2026-11-18 verification matrix

| Surface | Viewport | Locale | Result |
|---|---|---|---|
| Public `/` | desktop ~1366×768 | EN | No overflow defect demonstrated |
| Public `/es` | desktop ~1366×768 | ES | No overflow defect demonstrated (`SiteHeader` CTA fully visible) |
| Public `/es` | content width ~650px (DevTools docked) | ES | Hamburger nav; hero and CTAs wrap. No defect demonstrated |
| Public `/login` | desktop ~1366×768 | EN | Magic-link card readable. No overflow defect demonstrated |
| Phone ~390px | — | EN/ES | Not run |
| `/dashboard` and every signed-in module (portal, CRM, Marketing Studio, Communications, Local SEO, Analytics, AI Employees, Commerce orders, infrastructure, admin, deep-link focus, approvals) | — | EN/ES | **BLOCKED** — redirect to `/login`; no session |

No presentation correction is queued for v0. Order list, order detail, and lifecycle feedback were not on screen.

## After an authenticated session exists

Cursor repeats one desktop + mobile pass, including phone width and Spanish login. v0 changes only defects from that pass, on this same branch. PR #140 stays DRAFT until that pass and owner review. No auto-merge.