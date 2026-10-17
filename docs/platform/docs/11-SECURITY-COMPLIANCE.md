# 11 — Security, Consent, Tenancy, Healthcare and AI Control

**Security architecture is part of the target capability, not a product downgrade.** Every free and paid module follows the same tenant and privacy restrictions. A shared financial wallet does not loosen consent, medical confidentiality, sender identity, payment security or account isolation.

## 1. Identity and authorization

- Existing authentication remains **Auth.js** and existing `User.role`/`CustomerMembership` remain base authority. Do not migrate to Supabase Auth silently.
- Expand rights into separate `BillingGroupRole`, `AccountCapability`, `SiteCapability`, `AgentToolGrant`, provider connection scope and human approval policy; deny by default.
- Validate user/auth session and account/resource membership on **every** route, action, background worker and event; client-provided account IDs or cookies do not grant access.
- Admin/staff capability is logged and limited; use break-glass role with just-in-time access for exceptional operations.
- Commercial multi-tenant CRM/Chatwoot/Postiz must enforce independently isolated workspaces and credentials; integration test checks more than just UI filtering.

## 2. Data classification and allowed flows

| Data class | Examples | Required boundary |
|---|---|---|
| Public marketing | Published site pages, approved FAQs | May inform scoped marketing agent |
| Ordinary business PII | Contact name, email, phone, lead notes | Account-scoped encrypted storage, limited tool access and consent governance |
| Financial / payer | Group wallet, billing profile, invoices | Separate group rights and auditable money operations |
| Secret / credentials | API tokens, OAuth refresh tokens, DNS access, provider keys | Managed encrypted secrets; only opaque DB references, rotation and least scope |
| Regulated health/PHI potential | Patients, trial participation, clinical eligibility, medical notes | NO default processing by unapproved Chatwoot/Postiz/Resend/Paperclip/model services; BAA and compliance pathway required |
| Security/audit | Trace IDs, tool approvals, immutable financial events | Secure retention, append-only provenance and restricted access |

### Healthcare specifics

ABMED Clinical Research, ABMED Physicians Group and ABMED Aesthetics are distinct operating accounts. A single shared ABMED group wallet is a financial relationship **only**. No cross-sharing of patient/participant lists, campaigns, consent or medical communications. Resend states it does not support HIPAA/BAA requirements; Chatwoot not assumed HIPAA-ready; Twilio has conditional HIPAA-eligible arrangements for eligible services with executed BAA, which does **not** render unrelated AI/CRM architecture HIPAA-compliant. Healthcare workflows with PHI remain gated until vendor BAAs, risk assessment, required security controls, lawful basis and contract approval. Synthetic data only during POC. Never invent medical claims, trial eligibility or compensation.

## 3. Communication consent matrix

| Channel/purpose | Minimum policy |
|---|---|
| Website form reply | Respond under applicable transactional consent and privacy notice; separate from marketing |
| Marketing SMS | Appropriate prior consent/proof, sending brand/use case registration, opt-out management, quiet hours, suppression before each send |
| Marketing email | Consent/legal basis under applicable law, unsubscribe, sender domain verification, bounce handling |
| WhatsApp | Business policy/channel opt-in/templates where required; provider restrictions and window rules |
| Social publishing | Customer authorization for account/platform + approved content scope; external app/channel terms |
| AI voice outbound | Specific lawful consent and prerecorded/artificial voice requirements, caller ID, DNC/opt-out and state rules, recording law; default disabled |
| Clinical/healthcare information | Approved regulated data path and contractual controls; otherwise blocked |

Never treat a popup's phone-number entry as automatic AI prerecorded-call permission. Opt-outs immediately affect relevant sender/purpose; import cannot overwrite suppression. Legal counsel should validate specific U.S. federal/state rules and any international expansion before live automation.

## 4. AI agent security

- Typed Tool Registry with capability, actor, account, site, payer rights and risk level; deny all unknown actions.
- Model prompts, retrieved web pages, uploaded docs and CRM notes considered untrusted inputs. Prompt injection cannot change rights or switch account context.
- Agent run cost budgets, concurrency and provider scopes; immutable tool-call audit `agentInstanceId`, `actor`, `targetAccount`, `tool`, `approvedBy`, `requestId`, `argumentsHash`, `resultRef` and policy version.
- Human-in-the-loop for money, voice/SMS marketing, regulated claims, production deployment, domain changes, large file deletion and sensitive cross-site operations.
- No agent can forge owner review, website preview version approval or DNS cutover authorization; approvals bind to immutable artifact hash and resource.
- Kill switches per agent, account, provider and module; revoke tokens and pending jobs safely with audit.

## 5. Service-to-service trust and webhooks

- Authenticated private networking/firewalls where feasible, TLS for exposed endpoints, anti-SSRF in website crawler/connectors.
- HMAC/webhook signature and timestamp where supported, nonce/replay defense, unique provider event IDs, bounded input size and schema validation.
- Secrets referenced/rotated centrally, separate dev/staging/prod scopes, no production keys in test containers or PRs.
- One provider parent account can have customer child resources; mappings revalidated server-side on every send.
- Rate-limit per user/tenant/group/agent/provider; abuse/risk anomaly monitoring and financial kill switch.

## 6. Privacy retention, exports and audit

Retention policies by data class and applicable regulation. Customer access/export/delete within legal and operational requirements, acknowledging the need to retain certain financial/opt-out records. Record merge/export/download and consent changes. Limit storing raw conversation messages in duplicated WebXXL tables where Chatwoot owns the content; log metadata/provenance. Recording access restrictive; default disabled. Backups encrypted and periodically restore-tested. Cross-border hosting decisions documented.

## 7. License and provider due diligence

Before adopting Paperclip, Twenty, Chatwoot, Postiz, Hatchet or any future library, record exact release license, included enterprise-only features, self-hosting/embedded multi-tenant rights, network copyleft obligations, trademarks/branding, security notices, upgrade and maintenance responsibilities. **AGPL applies to some reviewed CRM/social tools**; an API adapter and a separately distributed modified service may have different obligations. Legal advice may be needed. No unsupported commercial sublicensing assumption.

## 8. Abuse and red-team acceptance

- Unauthorized site or billing group in request, forged cookie and ID enumeration denied.
- Agent tries to query sibling account contact/PHI or issue raw DB query — denied with audit.
- Direct Chatwoot native Twilio path without wallet/consent denied or disabled.
- Stale webhook replay cannot double debit or double-message.
- Unapproved outbound AI call blocked even if phone exists in CRM.
- SEO crawler cannot fetch internal IP/private endpoints or unrelated protected hosts.
- Postiz cross-tenant channel ID cannot publish on sibling site.
- Payment method card details never stored in WebXXL; subscription/domain checkout requires authorized billing payer.
