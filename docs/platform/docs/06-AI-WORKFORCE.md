# 06 — Unified AI Workforce: Internal Co-workers + Customer AI

**Business contract:** AI agents are operational capabilities throughout WebXXL, not disconnected chatbots. **MKT-08 (2026-10-18)** registers marketing/CRM follow-up tool names in `lib/platform/ai-tools/registry.ts` with **`enabled: false`** by default; durable marketing drafts use `DETERMINISTIC_DRAFT` unless a real configured model run is recorded as `AI_GENERATED`. Common marketing agents (SEO, landing page, campaigns, ad creative, lead suggestions) are included/FREE under appropriate use limits. Future customer-purchased specialist AI employees remain a disabled catalog capability. **Paperclip** is proposed for the internal worker manager; the customer AI runtime interface is provider-neutral. This is not an assertion that Paperclip is deployed.

## 1. Roles and scope

| Class | Examples | Owner/scope | Access level |
|---|---|---|---|
| Internal delivery agents | Project coordinator, Cursor engineer, QA reviewer, documentation, operations | WebXXL platform/approved repo | May draft code/PRs and reports, not deploy or approve silently |
| Included marketing agents | Local SEO analyst, landing-page designer, social campaign planner, ad creative agent, CRM lead monitor | Per-CustomerAccount/per-Site | Business-specific approved data and typed tools |
| Customer receptionist | Website chat lead intake, FAQs, support routing | Per CustomerAccount/Site/AgentInstance | Isolated knowledge, language, channel, escalation; regulated scope restrictions |
| Future commercial agents | Advanced sales agent, managed voice, specialist support, extended automation | Per billed entitlement and instance | Disabled until explicitly commercialized and operationally accepted |

**Ten-sites example:** one `AgentTemplateVersion` can instantiate 10 separate `AgentInstance`s with unique `customerAccountId`, `managedSiteId`, knowledge, contacts, provider connection, consent policy, limits and human escalation. One parent wallet can fund authorized metered communications; no cross-instance context leakage.

## 2. Shared AI Tool Registry (mandatory)

All agent actions use typed, centrally enforced tools, for example:

```
projects.readMilestones        projects.proposeUpdate       files.summarize
sites.scan                    sites.proposeChange         preview.createRequest
crm.contacts.search           crm.tasks.create           crm.leads.summarize
communications.draft          communications.requestApproval (NOT direct unsafe send)
social.createDraft            social.requestSchedulingApproval
seo.readSnapshot              seo.prepareFixProposal
wallet.readAuthorizedBalance  commerce.prepareQuote (NOT charge)
auth.requestHumanApproval     support.raiseTicket         analytics.summarize
```

Tool descriptor includes `name`, `schema`, `allowedActorTypes`, `accountScope`, `siteScope`, `role`, `serviceEntitlement`, `riskLevel`, `approvalPolicy`, `rateLimit`, `maxCost`, `auditCategory`, `providerAdapter`, `enabledFlag`. The server resolves account membership, not the prompt. Raw SQL, cross-account list-all, Twilio parent credentials, payment methods, unrestricted deploy and clinical records are **not** generic tools. Prompts and returned webpages are untrusted text; injection cannot grant capabilities.

### Autonomy tiers

- **Tier 0 Read:** summarize, recommend, classify, show SEO/report findings; may run automatically.
- **Tier 1 Draft:** prepare files, content, CRM proposed notes, campaign plans, developer PRs; versioned and reviewable.
- **Tier 2 Preauthorized:** publish only explicitly approved social posts/scope; bounded site technical changes by existing workflow; send transactional non-sensitive updates where authorization is established.
- **Tier 3 Explicit per-action approval:** mass SMS/email campaigns, external spending, paid subscriptions, domain registration, production release, regulated claims, business policy modification, outbound AI calls.
- **Tier 4 Denied:** impersonate human approval, bypass consent/wallet, create hidden charges, access unrelated accounts, transmit PHI via unapproved providers, delete immutable financial/approval records.

## 3. Internal Paperclip pilot

**AGENT-03 (2026-10-18):** WebXXL backend now owns internal task, approval, budget, pause, and tool execution gateway contracts under `lib/platform/workforce/*`. Five internal agent roles are registered with live execution **disabled** by default. Paperclip remains an external control plane reference (`WorkforceProvider` pin v2026.325.0); no Paperclip containers or LLM keys are activated in this batch.

**AGENT-03A (2026-10-18):** Authorization and accounting hardening — `resolveTrustedWorkforceHuman()` gates human approvals and pause controls (caller `actorType` is not proof); `authorizeWorkforceTask()` verifies approvals before AUTHORIZED; generic transitions cannot bypass authorization; budget settlement/release rules enforced in-memory (durable transactional accounting deferred to staging pilot); workforce execution/tool-call/approval rows use restrictive delete semantics in pending migration; supervised workflow helpers are **test-only** and honor active pauses. Paperclip adapter remains a **stub boundary**, not verified live HTTP.

1. Confirm upstream repo version, API/agent adapters, maintenance/security notices, self-host licensing, isolation and admin authentication **before** deployment.
2. Deploy isolated from Stocksist/WebXXL production; separate Docker Compose/volumes/secrets/network and bounded CPU/RAM.
3. Define `WebXXL Internal Workforce`: five agents (Project Manager, Engineer, QA, Documentation, Operations). Import only reviewed role configurations, not huge unattended swarms.
4. Connect approved Cursor Cloud agents and GitHub in least-privilege mode: branch/PR only, no direct merge/publish or production DB access; keep v0 UI ownership.
5. Set global/per-agent budgets, heartbeat/schedule intervals and approval rules. Test 3 traceable nonproduction tasks with cost and results.
6. Use a `WorkforceProvider` adapter; keep WebXXL task IDs and correlated GitHub PR/run IDs in WebXXL logs. Paperclip company/agents are internal control plane, not default customer CRM or contact engine.

## 4. Agent instance lifecycle

`TEMPLATE_DRAFT -> TEMPLATE_APPROVED -> ACCOUNT_INSTANCE_CREATED -> CONFIGURING -> SANDBOX_READY -> PENDING_ENABLEMENT -> ACTIVE -> PAUSED/DEGRADED -> RETIRED`. Instance setup: customer/site, business knowledge, channel mapping, locale, staff handoff, tools, risk cap, fair-use quota, monthly spend policy, retention and consent policy. Always permit emergency pause/revoke and safe replacement of model/provider.

Future commerce: `AgentCatalogItem` may have FREE included or PAID deferred price. Purchased agent deployment triggers entitlement check then instance provisioning; no automatic account-wide grant. Prices remain configurable by version. Free included marketing agent entitlements may be applied automatically to eligible accounts while feature flag gates deployment readiness.

## 5. Knowledge and retrieval

- Allowed: customer-owned public website, explicitly approved FAQs, service descriptions, approved CRM fields and reviewed marketing materials, scoped by site/account and version.
- Restricted: cross-account contact lists, private medical research recruitment records, unreviewed study compensation, patient information, stored secrets, employee-only files not authorized for agent.
- All generated assertions are source-linked when possible; unsupported sensitive claims withheld for review. Retrieval must enforce account-level filters before providing context.
- EN/ES knowledge parity and business-defined tone rules; audit which knowledge version an agent used.

## 6. AI workflow: overdue leads

Trigger periodically for eligible CRM account: find leads created >= policy threshold ago (example four days) with **no qualifying recorded outbound follow-up** in connected channels, no completed callback task, no suppression or exclusion, and adequate coverage. Aggregate ten leads and notify assigned staff (e.g., Dee in illustrative Physicians Group scenario): 'Ten leads have no recorded follow-up in four days. Would you like drafts or callbacks assigned?' Staff approves a permitted follow-up channel; the gateway checks explicit consent and sender. AI can draft, enqueue approved messages, escalate to human, or produce a callback task; all updates become timeline events. If channels are disconnected, notification states **coverage limitations**, not 'definitely never contacted'.

## 7. AI voice future adapter

`VoiceAgentProvider` choices: ElevenLabs managed or LiveKit open source; Twilio/telephony transport where authorized. Inbound reception vs outbound marketing/appointment follow-up have different legal rules and consent. Outbound AI voice disabled until caller identification, recording disclosure if applicable, TCPA/FCC, DNC, calling hours, opt-out, healthcare/BAA, human transfer and provider terms are reviewed. Record call metadata/disposition only under approved retention; no unconsented automated dialing.

## 8. Cost guardrails (FREE program viability)

Per account and per agent: model choice, token cost, number of tasks, crawl cadence, draft asset size, image/media cost, voice minute rate, third-party quota and concurrency; enforce soft/hard limits, prioritized scheduling and cache. Never silently create a paid subscription when free task limit reached; show queue/degraded state or request operator approval. Dashboard should distinguish **customer charge $0** from **WebXXL internal AI expense**.

## 9. Acceptance

- 10 agents across 10 sites have isolated knowledge, provider credentials, CRM and message rights; one billed wallet may be shared only via separate authorization.
- AI generated work shown as Draft until actual deliverable saved; PUBLISHED only after verified external provider/PR/deployment event.
- Prompt injection requesting transfer/payment/cross-tenant data is rejected and audited.
- Pause/revoke stops new tool calls; interrupted job follows safe cancellation/recovery policy.
- AI cannot approve its own content, production deploy, financial charge or use regulated data without gate.
