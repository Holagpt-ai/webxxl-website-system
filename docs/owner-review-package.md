# Owner review package (WebXXL portal)

Structured media, content, and privacy decisions for **ABMED Clinical Research Redesign** live in:

- Catalog: `lib/owner-approval-checklist.ts`
- Persistence: `ProjectOwnerReviewDecision` (Prisma)
- Customer UI: `/dashboard/review` (EN/ES)

This workflow does **not** approve website deployment versions or authorize DNS cutover. Existing dependencies (`abmed-cr-dep-studies`, `abmed-cr-dep-media`, `abmed-cr-dep-privacy`) are unchanged and are not auto-resolved when individual items are approved.

See ABMED repo `docs/owner-review-package.md` for the website-side inventory source.
