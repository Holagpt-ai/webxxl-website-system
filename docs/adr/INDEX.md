# WebXXL Decision Index

**Decision record registry — 2026-10-25 initial proposed ADR system.** Read together with the authoritative existing [decision changelog](../platform/docs/15-DECISIONS-CHANGELOG.md) and [Master TAD](../platform/docs/01-MASTER-TAD.md). This index is navigation, not approval authority.

| ID | Topic | Decision state | Record | Approval source | Implementation/release note |
|---|---|---|---|---|---|
| ADR-001–017 | Modular platform, portal preservation, tool ownership, account/billing separation, free inclusion policies, provider-neutrality, bilingual, no downgrades | Locked owner requirements in canonical log | [Legacy decisions](../platform/docs/15-DECISIONS-CHANGELOG.md) | Canonical decision changelog | Individual code and deployment state varies |
| ADR-018 | Component adoption vs whole-platform replacement | PROPOSED | [Selective integration policy](ADR-018-selective-provider-integration-policy.md) | NONE — owner review required | No new vendor authorized |
| ADR-019 | Content editor / headless CMS selection | PROPOSED | [CMS adapter decision gate](ADR-019-cms-adapter-decision-gate.md) | NONE — owner review required | No Payload/Strapi/Directus selection |
| ADR-020 | Optional customer automation builder | PROPOSED | [Automation builder decision gate](ADR-020-optional-automation-builder-gate.md) | NONE — owner review required | Existing Prisma workflow remains; no Activepieces activation |

## Existing decisions with separate technical evidence

- **ADR-004 / ADR-005:** independent operating accounts and billing group payer — see Master TAD tenancy and group wallet requirements.
- **ADR-011:** Chatwoot preferred conversation layer, with WebXXL communications/consent gateway — see `docs/platform/docs/07-CRM-COMMUNICATIONS.md` and provider register. Preferred is **not** proof that Chatwoot is live.
- **ADR-012:** Paperclip/Hatchet/Twenty are candidates. The implemented AUTO-10 **Prisma-first** rationale is in [`AUTO10-PROVIDER-DECISION.md`](../platform/docs/AUTO10-PROVIDER-DECISION.md); do not recast Hatchet as selected.
- **ADR-003:** Cursor backend/CI/Git; v0 UI/UX — binding file ownership.

## How to register a new choice

1. Confirm no existing ADR-001..017 or proposal governs the same exact question.
2. Assign the next number **ADR-021** (unless another ADR has already been committed), and use the template.
3. Add exactly one index row; proposed items must clearly remain proposed.
4. After explicit owner decision, update status and canonical decision changelog in one reviewed PR.
5. If a prior approval is replaced, make a new superseding record instead of rewriting history.
