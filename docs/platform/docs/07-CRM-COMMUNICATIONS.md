# 07 — Free Robust CRM, Chatwoot, Unified Communications & Lead Recovery

**COMMS-06 (2026-10-18):** Unified communications backend in `lib/platform/comms/*` with Prisma tenant/conversation/gateway models, typed Chatwoot Application API adapter, verified private webhook relay (`x-webxxl-chatwoot-signature`), policy engine, quote/intent preparation, and gated `/api/v1/communications/*`. **Chatwoot is not installed or running**; **no live SMS/email/WhatsApp**. Billable outbound must use WebXXL gateway (see `infra/services/chatwoot/MESSAGING-GATEWAY.md`).

**CRM-05 (2026-10-18):** WebXXL-native Prisma CRM foundation landed in `lib/platform/crm/*` with gated `/api/v1/crm/*` routes, consent/suppression, segmentation engine, import/export preparation, SalesLead bridge, and Chatwoot contact mapping. **Twenty remains a candidate** (`CRM_EXTERNAL_SYNC_ENABLED=false`). See `07-CRM-VENDOR-MATRIX-CRM05.md`.

**Customer charge:** robust CRM software, list segmentation and marketing automation drafts are **FREE/included**. **Provider SMS usage** and separately priced transport are chargeable according to published terms. All accounts must remain independent, even inside one payer group.

## 1. CRM capabilities — full target scope (do not downgrade to a basic address book)

- **Contacts + companies:** person names, preferred name, organization, job title, multiple normalized phones/emails, address, WhatsApp handle, permitted social IDs, locale/timezone, source/attribution, website/site association, contact owner, custom fields, relationships, tags, files/notes and linked opportunities.
- **Sales:** configurable pipelines and stages, deal value/source/probability, close/loss reasons, products requested, tasks, reminders, SLA response metrics, internal assignment and manual/AI prioritization.
- **Segments:** saved filter builder with AND/OR, static lists, dynamic rules and memberships, exclusions, owner/team, channel eligibility and campaign participation. Views: Recent leads, Overdue, Never contacted **in connected data**, No campaign sent, No campaign delivered, Awaiting reply, High-intent, Expired follow-up, Website popup source, Invalid consent.
- **Import/export:** CSV with mapping preview, normalized identity, per-account dedupe, merge review, field validations, error report and auditable export; import **never manufactures consent** or unsuppresses opt-outs.
- **Omnichannel:** web form/popup, web chat, inbound/outbound email, SMS, eligible WhatsApp, phone attempt/call outcome, supported social DMs; contact-centered activity timeline. Event tracks direction, provider, timestamp, actor, channel, delivery/disposition, source link and consent basis. Avoid claiming recording content exists when only a disposition is connected.
- **Contact-to-campaign history:** participation, selected/eligible, sent, provider accepted, delivered/bounced, opened/clicked if supported and privacy-permitted, unsubscribed, reply; distinguish no campaign *sent* from no campaign *delivered*.
- **Permissions and reporting:** per-account ownership and export controls; group billing does not grant CRM visibility. Lead response time, first-touch conversion, SLA aging, outreach coverage, pipeline and campaigns.
- **AI:** lead summaries and recommendations, draft outreach, business-specific onboarding, 4-day (configurable) uncontacted detection, staff notifications, escalation, action approvals, bounded authorized message sending.

## 2. CRM engine procurement gate

**Twenty** is first candidate, not preselected production vendor. Validate: full contact/company/deal/task/custom-object API; multi-workspace isolation, per-workspace user roles, admin/tenant provisioning, Auth.js identity mapping/SSO, import/export, webhooks/event updates, backups, audit and reliable performance; current AGPL/enterprise licensing/embedding rights and costs. If it adds unacceptable duplicated account authority or commercial restrictions, use `CrmProvider` with EspoCRM, Corteza, or WebXXL-native modular CRM. **No functional downgrade** permitted; report cost/hosting/license tradeoffs to owner. UI remains v0.app inside WebXXL, not a second CRM user login.

### Identity authority

WebXXL `CustomerAccount` and account-scoped contact references are authoritative for tenant and permissions; CRM backend may own rich company/deal attributes. `CrmProvider` adapter maps every external workspace/object to the authorized WebXXL account. Bidirectional sync uses provenance/conflict precedence and dedupe; never silent 'last write wins' for consent or owner permissions. Contact merges only within one customer account and with identity confidence/review.

## 3. Chatwoot division of responsibility

Chatwoot: conversations, agent inbox, chat/web, supported social conversations, email and appropriately configured SMS/WhatsApp interfaces, participant/message states and human escalation. WebXXL: CRM identity/consent, billing, campaigns, wallet, audience segmentation, approval, AI tool grants, sender validity and audit. Each independent CustomerAccount has separate Chatwoot account/inboxes or validated isolation mapping. Use API/webhooks; do not merge Chatwoot source into WebXXL Next.js repository. Commercial branding/enterprise entitlement verified for actual selected edition.

**Billable outbound anti-bypass:** native direct Chatwoot→Twilio SMS sends by arbitrary operators could evade wallet and consent checks. Preferred Chatwoot **API Channel** → WebXXL messaging gateway → sender-specific Twilio API for outbound, with mirrored message state/inbound routing back to Chatwoot. Production activation is blocked until architecture guarantees all send paths enforce policy; test other channel types separately. Channel capabilities vary; do not assume automatic WhatsApp parity.

## 4. Canonical contact timeline states

Event types: `FORM_SUBMISSION`, `WEB_CHAT_STARTED`, `INBOUND_SMS`, `OUTBOUND_SMS_REQUESTED`, `SMS_ACCEPTED`, `SMS_DELIVERED`, `SMS_FAILED`, `EMAIL_SENT`, `EMAIL_BOUNCED`, `SOCIAL_DM_RECEIVED`, `CALL_ATTEMPT`, `CALL_CONNECTED`, `CALL_DISPOSITION`, `HUMAN_REPLY`, `AI_REPLY`, `NOTE`, `TASK_CREATED`, `TASK_COMPLETED`, `CAMPAIGN_INCLUDED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`, `OPT_OUT`, `CONTACT_MERGED`. Each event has `sourceSystem`, `externalEventId`, `occurredAt`, `ingestedAt`, `coverage`, `direction`, `identityConfidence`, `actor`, `consentScope` (where applicable). Timeline API paginates, orders by event occurrence and clarifies stale provider sync.

**Lead source rule:** browser pop-up submission only establishes source and captured consent choices. It is *not* proof of permission for marketing texts, AI prerecorded calls or multiple brands.

## 5. SMS/email central routing

- **Twilio initial:** one WebXXL-managed parent account, approved subaccount/sender resources per business/legal entity/use case as needed; A2P/10DLC brand/campaign enrollment separately determined per actual business and campaign. Do not register unrelated clients as a generic WebXXL sender. Telnyx/Bandwidth optional provider implementations.
- **Resend initial:** WebXXL central account may verify multiple sender domains; allow only approved non-PHI workflows unless legal/security reviews and provider BAAs permit otherwise. Resend is not acceptable for PHI workflows under currently stated vendor position.
- **Channels:** email transport and SMS transport are distinct; chat/in-app messages have distinct delivery and billing rules. Provider limit, segment count, sender registration and unsubscribe are enforced. No unlimited free SMS.
- **Inbound:** validate vendor signatures, map receiving number/domain/provider subaccount to exactly one customer account, match or queue human contact reconciliation, update timeline and Chatwoot, trigger STOP suppression before future sends.
- **Suppression:** global/shared controls where required by policy and account/sender-specific legal scope; centralized wallet does not grant consent to sibling sites.

## 6. Compliance, consent and healthcare

Per channel/purpose, store consent provenance, timestamp, terms/screen text/version, source URL/form, collected phone/email and applicable sender. Distinguish transactional, marketing, AI voice and healthcare. Respect opt-out and quiet hours. Provider use for PHI requires legally appropriate configurations, risk analysis and applicable BAAs across **each** participating system, including models, CRM, Chatwoot, logs and storage. Chatwoot is not assumed HIPAA-ready; no clinical-sensitive content to unapproved AI. Clinical Research participant information separated from Physicians/Aesthetics despite pooled wallet.

## 7. Lead recovery sequence (four-day scenario)

```
Website popup -> POST authorized lead capture -> CRM contact/timeline
  -> dueDate = business LeadFollowUpPolicy (example: +4 days)
  -> worker checks connected-channel coverage, qualifying outbound, assignment, consent
  -> 10 untreated leads consolidated in staff notification (e.g., Dee)
  -> human decides: draft email, assign callback, create task, propose SMS
  -> appropriate policy/consent/wallet check; optional approval
  -> Chatwoot/communication gateway executes only authorized actions
  -> timeline captures provider outcome + next follow-up; no duplicate nagging
```

Handle manual human phone calls (staff log/disposition) so AI does not repeatedly flag already handled leads. A legitimate business may opt into specific preapproved low-risk auto follow-up only after consent and lawful-purpose checks; voice marketing remains disabled initially.

## 8. Voice service contract

`VoiceAgentProvider` can wrap ElevenLabs managed or LiveKit (telephony/SIP via authorized provider); select after staging demo, legal/consent and cost/per-minute test. Inbound AI website/phone receptionist and outbound lead callback need separate opt-ins and provider configuration. Explicit humans approve campaigns; caller ID, AI disclosure, DNC checks, local calling windows, recording policies, voice consent and opt-out required. Voice may use purchased carrier/API credits, but software feature entitlement does not imply free airtime.

## 9. CRM acceptance criteria

- Three synthetic ABMED accounts with independently provisioned CRM and Chatwoot objects; contacts never leak across sibling accounts.
- 200-contact segment, opt-out filter and import/export produce accurate eligibility and evidence; no consent laundering.
- Search, lists, tags, pipelines, tasks, custom fields, owner, history and 360° timeline work in EN/ES/mobile.
- Four-day monitor flags only uncovered/uncontacted according to policy and indicates disconnected sources.
- Any AI or staff outbound billable message passes WebXXL gateway; forced Chatwoot native bypass denied/disabled.
- SMS inbound replies and opt-out update correct contact and sender-specific suppression promptly and idempotently.
