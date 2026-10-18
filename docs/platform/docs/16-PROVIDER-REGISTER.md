# 16 — Provider / Repository Register & Due-Diligence Checklist

**Status:** catalog of researched candidates; **not** a declaration of installed/working integrations. Verify actual release, edition, pricing, service terms and license at implementation. Vendor claims can change. Integration contracts stay provider-neutral so WebXXL can upgrade or swap providers without changing data ownership.

| Layer | Provider / repo and docs | Intended use | Selection state & gate |
|---|---|---|---|
| Main WebXXL code | [`Holagpt-ai/webxxl-website-system`](https://github.com/Holagpt-ai/webxxl-website-system) | Existing Next.js/Auth.js/Prisma portal | **Actual implementation base**, inspect `main` |
| UI design/build | [v0.app](https://v0.app/) | All public + customer/admin UI/UX | **Owner-mandated** |
| Backend development | [Cursor](https://cursor.com/) | Backend, migrations, integrations, tests, Git/deploy logic | **Owner-mandated** |
| Web hosting | [Vercel](https://vercel.com/) | WebXXL app production and preview hosting | **Owner-mandated** |
| Self-hosting | [Hostinger](https://www.hostinger.com/) / Docker | Isolated specialist apps | Existing account/Docker, capacity/identity not yet established |
| Social scheduler | [Postiz GitHub](https://github.com/gitroomhq/postiz-app) / [Postiz](https://postiz.com/) | Approved social post scheduling and channel analytics | **Existing instance candidate** at `app.webbxxl.com` (Postiz UI verified 2026-10-18); separate staging `webxxl-stg-postiz`; pin reference **v2.25.1**; AGPL review required |
| Conversation platform | [Chatwoot GitHub](https://github.com/chatwoot/chatwoot) / [Application API docs](https://developers.chatwoot.com/) | Chat/inboxes, conversations; billable SMS must route via WebXXL gateway | **COMMS-06:** `chatwoot-conversation.ts` (Application API `api_access_token` only); staging compose **v4.18.0-ce**; **not installed/running** in this batch |
| CRM (native) | `lib/platform/providers/webxxl-native-crm.ts` | Account-scoped contacts, companies, pipelines, deals, tasks via Prisma | **CRM-05 backend adapter** — system of record; `CRM_BACKEND_ENABLED=false` until migration apply |
| CRM | [Twenty GitHub](https://github.com/twentyhq/twenty) / [docs](https://docs.twenty.com/) | Rich people/companies/deals/pipelines/custom objects | **Candidate only** (`twenty-crm.ts`), multiworkspace/Auth.js/licensing POC; AGPL & edition conditions — **not selected** |
| CRM alternative | [EspoCRM GitHub](https://github.com/espocrm/espocrm) | Traditional full CRM | Alternative if Twenty fails gate; PHP stack |
| CRM alternative | [Corteza GitHub](https://github.com/cortezaproject/corteza) | Low-code/open CRM building blocks | Alternative, Apache-2.0 repo/license version check |
| Internal workforce | [Paperclip GitHub](https://github.com/paperclipai/paperclip) / [docs](https://docs.paperclip.ing/) | Internal AI employee manager, tasks, budget and agent adapters | Staging override **v2026.325.0** reference; build-from-source; **not activated**; license verify on tag |
| Durable jobs | [Hatchet GitHub](https://github.com/hatchet-dev/hatchet) / [docs](https://docs.hatchet.run/) | Durable orchestration/jobs/lease/retries | Preferred candidate only; avoid duplicating WebXXL existing worker/Postiz scheduler |
| Workflow alternative | [Trigger.dev GitHub](https://github.com/triggerdotdev/trigger.dev) | TypeScript durable background jobs | Evaluation fallback |
| Optional no-code automation | [Activepieces GitHub](https://github.com/activepieces/activepieces) | Internal workflow design for teams | Not core execution dependency; free/enterprise embedding/AI agent limits verified before use |
| SMS provider | [Twilio](https://www.twilio.com/) | ISV parent/subaccounts, SMS and sender registrations | **WALLET-09:** `twilio-sms.ts` prepare/normalize + mock transport; `TWILIO_ADAPTER_ENABLED=false`; no live API |
| SMS alternatives | [Telnyx](https://telnyx.com/) / [Bandwidth](https://www.bandwidth.com/) | Backup/competitive SMS routing | Provider-neutral adapters future |
| Eligible email provider | [Resend](https://resend.com/) | Multi-domain non-PHI email | **WALLET-09:** `resend-email.ts` domain-bound prepare + mock transport; `RESEND_TRANSPORT_ENABLED=false`; PHI restrictions unchanged |
| AI voice managed | [ElevenLabs](https://elevenlabs.io/) | Conversational AI voice via authorized telephony | Future candidate; regulated outbound disabled |
| AI voice open source | [LiveKit Agents](https://github.com/livekit/agents) | Real-time voice/SIP agent framework | Future alternative; telephony/consent/hosting gate |
| Search performance | [Search Console API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) | Property organic metrics and URLs | **SEO-07:** `google-gsc-seo.ts` typed Search Analytics + mock transport; `SEO_GSC_API_ENABLED=false`; owner OAuth verified site; Google quotas/delays |
| Website traffic | [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) | GA4 traffic/engagement/conversions | Property and OAuth setup |
| Maps/listing performance | [Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest) | Owned business location/listing | Appropriate Business Profile/API approval |
| Competitor discovery | [Google Places Text Search](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText) | Nearby relevant business discovery | Paid/quota/ToS, not proof of exact keyword rank |
| Keyword local rank | licensed provider TBD | Exact geo+keyword search observation | Open procurement gate; report source/method |
| Payment provider | Stripe/Paddle/Lemon Squeezy/other TBD | Checkout, payment, subscription and invoices | **Not selected**; provider-neutral abstraction mandated |
| Domain/hosting/email seller | registrar/reseller TBD | Domain registration, hosting and mail fulfillment | Open provider selection; distinct from WebXXL wallet |

## Vendor qualification form

**Before enabling production:**

1. Exact repository URL, pinned release and hash, maintenance activity, supported Node/DB/Redis/etc versions and security advisories.
2. Source license, trademark/white-label and hosted multi-tenant/embedded use, AGPL/network conditions, paid feature list, internal legal signoff if needed.
3. Can customer A's contacts, sends, channels, API tokens and exports be fully isolated from B under shared operator administration? Proof with tests.
4. API auth, pagination, webhooks, retry/rate limits, signatures and lifecycle states; private network/SSO options.
5. Cloud vs self-hosted comparison for backup, scale, uptime, data portability and vendor exit.
6. Per-tenant usage metering and cost estimates with expected number of sites/users, annual licensing/support obligations.
7. Provider-specific healthcare/PHI policy/BAAs as applicable; customer consent, geographic restrictions and messaging compliance.
8. Clear go/no-go decision in `15-DECISIONS-CHANGELOG.md` and module mapping in `04-API-INTEGRATIONS.md`.

## Official reference notes

- Google Search Console returns **average position** and may omit data rows; API data can lag by days, and quotas apply. Do not present its metrics as real-time local Maps rank.
- Google Places Text Search is business discovery, not local rank grid evidence.
- `Postiz` and `Twenty` source licenses can impose obligations when self-hosting/modifying network services; review actual installed release and commercial usage.
- `Chatwoot` enterprise-only features, AI features and branding require edition-level due diligence; community code is not necessarily every feature in marketing pages.
- Healthcare compliance cannot be inferred from Twilio/Resend/Chatwoot presence or a single BAA; the entire data path must qualify.
