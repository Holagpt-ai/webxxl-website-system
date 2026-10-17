# Cursor First Assignment — DOC-00 / Architecture Reconciliation

**PASTE ONLY AFTER THE OWNER HAS ACCEPTED THIS DOCUMENT SET AND ITS PROPOSED OPEN-DECISION DEFAULTS.** Do not use this assignment to deploy applications or edit production records.

## Role and reading

You are WebXXL's backend/infrastructure engineer in Cursor. Read and respect `README.md`, `docs/00-SESSION-START.md`, **all** `docs/01-MASTER-TAD.md`, `docs/02-CURRENT-STATE.md`, `docs/15-DECISIONS-CHANGELOG.md`, and the relevant domain documents. The owner prohibits silent downgrades or replacing approved scope. You own backend/data/APIs/Git/CI/deployment logic; **v0.app owns all UI/UX**, including customer and admin portal. WebXXL is hosted on Vercel, other services may be on isolated Hostinger/Docker. Preserve Stocksist environment separately.

## Assignment

1. Verify actual WebXXL repository path/branch/main SHA, production deployment host and environment mapping; no mutation.
2. Verify each `02-CURRENT-STATE.md` asserted existing fact against repo, and identify gaps/non-current assumptions. Keep existing account roles, `CustomerAccount`/`CustomerMembership`, `ManagedSite`, `ServiceOrder`, `CustomerService`, notifications, project preview/version approvals and public/dns cutover controls intact.
3. Identify which logical entities from `03-DATA-MODEL.md` already exist, should be extended or require a new table. Produce a migration dependency proposal; **do not apply migration** in this batch.
4. Cross-check `lib/portal/modules.ts`, `config/features.ts`, `lib/marketplace/catalog.ts`, `lib/integrations/scheduler.ts` for FREE product policy mismatches and Postiz activation status. Do not touch frontend in this batch.
5. Verify license, self-hosted edition and multi-tenancy requirements for Paperclip, Twenty, Chatwoot, Postiz, Hatchet and the initial SMS/email APIs. Record risk and alternative, preserving all requested capabilities.
6. Check available Hostinger/Docker specs only where access exists; explicitly list user-provided steps still needed. Do **not** interfere with Stocksist.
7. Propose exact backend API and provider boundaries, staging deployment repos/paths, source-of-truth choices, open owner decisions and high-impact migrations.
8. Write a concise DOC-00 compatibility report and update the documentation statuses, with source links, SHA and verification evidence. If documentation changes, commit them on an isolated docs branch and present PR; do not merge/deploy without authorization.

## Required output

A. Current main SHA and production/preview verification status (separate).  
B. Existing entities/routes reused vs extended vs new; conflict list.  
C. Provider licensing/tenancy/API concerns with recommended resolution and alternatives.  
D. Files anticipated in FOUND-01; v0.app-owned surfaces excluded.  
E. Exact owner actions (VPS data, Google properties, social apps, potential Twilio, billing processor only when scheduled).  
F. First implementation batch plan with targeted tests and rollback.  
G. No downgrade, no mass sends, no PHI, no payment charges, no production migrations.

## First production implementation after DOC-00 approval

**FOUND-01:** BillingGroup/CustomerAccount identity contracts, group wallet/payment relationship foundations, agent capability registry and service adapter types; migration add-only, no move of existing ABMED objects until owner separately approves. Maintain complete long-term system spec even if new UI remains flagged off.
