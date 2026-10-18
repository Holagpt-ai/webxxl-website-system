# CRM-05 vendor comparison matrix (evidence-based, no selection)

| Criterion | WebXXL native (Prisma) | Twenty (candidate) | EspoCRM (alternative) | Corteza (alternative) |
|---|---|---|---|---|
| Contacts/companies/relationships | Implemented in CRM-05 (`CrmContact`, `CrmCompany`) | Documented REST objects (`/rest/people`, companies) — **not installed** | Mature CRM entities in PHP app — **not evaluated live** | Module/record builder — **not installed** |
| Pipelines/deals | `CrmPipeline`, `CrmDeal`, stage history | Pipelines/opportunities in product — sync **disabled** | Native opportunities — stack mismatch | Compose workflows — higher assembly cost |
| Tasks/activities | `CrmTask`, `CrmTimelineEvent` | Partial via activities — tasks **UNSUPPORTED** in adapter | Tasks/activities native | Workflow tasks via automation |
| Custom fields | JSON `customFields` on contact/company | Custom fields in Twenty — mapping TBD | Espo custom fields — TBD | Low-code fields — flexible |
| Segmentation | Typed filter engine (`segment-engine.ts`) | Saved views/filters upstream — not wired | Reports/filters upstream | Compose views |
| External API | `/api/v1/crm/*` (gated) | GraphQL/REST documented at [docs.twenty.com](https://docs.twenty.com/) | REST API documented | REST API documented |
| Multi-workspace isolation | **CustomerAccount** enforced on all writes | Workspace concept exists — **WebXXL mapping unverified** | Instance/tenant model — PHP deployment | Namespace isolation — needs POC |
| Auth.js / SSO fit | Native session + membership | Requires separate auth bridge | Separate PHP session/OAuth | Separate auth realm |
| Licensing | WebXXL-owned code | **AGPL** — commercial embedding requires legal review | AGPL / proprietary editions | Apache-2.0 (verify tag) |
| Healthcare/PII | PHI processing **disabled** in CRM-05; consent/suppression foundations | Vendor policy/BAA not assumed | Same | Same |
| Self-host cost | Postgres already used | Node + Postgres + workers (non-trivial) | PHP stack separate from WebXXL | Go services + DB |

**Recommendation for CRM-05:** Continue **WebXXL-native CRM** as the system of record. Keep **Twenty** as a **candidate external sync target** only (`CRM_EXTERNAL_SYNC_ENABLED=false`). Do **not** declare Twenty selected until workspace isolation, Auth.js bridge, AGPL/commercial review, and owner approval complete. EspoCRM and Corteza remain fallbacks if Twenty fails the qualification gate in `16-PROVIDER-REGISTER.md`.
