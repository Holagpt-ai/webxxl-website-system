# 14 — WebXXL Acceptance and Anti-Regression Matrix

**Status:** approved acceptance target, not a report of executed tests. Implement focused tests in each relevant batch; execute full integrated matrix before commercial release. Use **synthetic** contacts and no clinical/PHI data during POCs. Record result/evidence, date, environment, source SHA and approving role for every release gate.

## A. Existing portal preservation (P0)

| Test ID | Scenario | Pass condition |
|---|---|---|
| BASE-01 | Customer logs in to existing EN and ES dashboard | Current Overview screenshot structure, project selector, nav and responsive experience intact |
| BASE-02 | Current ABMED project preview | Correct deployment/version/source shows; owner can approve or request changes only on exact immutable preview version |
| BASE-03 | Owner review and domain cutover | Owner checklist cannot autoapprove website version; preview version approval cannot authorize DNS migration |
| BASE-04 | Sites, Files, Messages, Requests, Support, Services, Infrastructure, Notifications | Existing features and roles unaffected by new feature-flagged modules |
| BASE-05 | Account/project switch with multiple memberships | Active account changes only authorized data; project remains in account context |
| BASE-06 | Existing service orders and historical quotes | No mutation/disappearance after FREE offering reclassification; historical order semantics preserved |

## B. Billing group and shared wallet (P0)

| Test ID | Scenario | Pass condition |
|---|---|---|
| WAL-01 | Top up ABMED with 1,000 example credits | Exactly one wallet ledger credit with provider settlement correlation |
| WAL-02 | Aesthetics spends 200 | All authorized group balance views show 800 |
| WAL-03 | Physicians spends 100 next | All authorized group balance views show 700 |
| WAL-04 | Clinical spends 50 next | All authorized group balance views show 650; debits attributed correctly |
| WAL-05 | Three simultaneous multi-site campaigns | Holds atomic and available never negative; duplicate request never double charges |
| WAL-06 | Duplicate/out-of-order Twilio callbacks | No double settle/refund; provider and ledger reconcile |
| WAL-07 | Site reaches site-specific cap but group has balance | Site denied, siblings allowed within their rules; group wallet intact |
| WAL-08 | Billing-group member unlinked | Historical usage retained, new reservation unauthorized, outstanding holds settled/released safely |
| WAL-09 | Group payer buys domain and website subscription | Same authorized payment account; money order/invoice, **no usage-credit debit** by default |
| WAL-10 | Wrong group/forged URL parameter | Financial data denied; no balance or payment method leakage |
| WAL-11 | Free core CRM/SEO/marketing service | $0 additional software fee; no implicit subscription/checkout |
| WAL-12 | Provider reconciliation/chargeback | Wallet and payment ledgers remain auditable; no phantom funds |

## C. CRM/communications (P0/P1)

| Test ID | Scenario | Pass condition |
|---|---|---|
| CRM-01 | ABMED three independent businesses | Contacts, pipelines, tasks and custom fields isolated; wallet sharing does not merge contact data |
| CRM-02 | CSV import with duplicate phone/email | Preview & per-tenant merge correct, consent preserved; invalid rows report errors |
| CRM-03 | CSV export by authorized/unauthorized user | Authorized scoped export, unauthorized denied and event audited |
| CRM-04 | Segment builder and smart lists | New, overdue, never recorded follow-up, no campaign, waiting reply all rule-based and correct |
| CRM-05 | Lead inbound from web popup | Source and consent choices captured; inbound **not** counted as outbound reply |
| CRM-06 | Contact 360° timeline | Chat/SMS/email/phone/social events source/direction/time/provenance correct; disconnected coverage noted |
| CRM-07 | Four-day follow-up for ten leads | One consolidated assigned staff notice, drafts available, no automated unconsented outbound call |
| CRM-08 | STOP SMS inbound | Timely suppression applied to correct sender/purpose and blocks further eligible sends |
| CRM-09 | Chatwoot direct-send bypass attempt | Forced through gateway or blocked; no unbilled direct billable SMS |
| CRM-10 | Consent absent/invalid or sender unregistered | Outbound blocked before reservation/send, explicit reason shown |
| CRM-11 | API/webhook replay | No duplicate contact, timeline, message or wallet event |
| CRM-12 | Clinical/PHI data through unapproved Chatwoot/Resend/AI | Denied, no content in log/provider |

## D. Postiz, FREE Marketing Studio and autonomous content (P0/P1)

| Test ID | Scenario | Pass condition |
|---|---|---|
| POST-01 | Existing external scheduler route only | UI distinguishes external available from full API activation; no false “integrated” status |
| POST-02 | Self-hosted Postiz API/token and customer channel | Real connection validated with scoped channel mappings |
| POST-03 | AI 30-day marketing plan | Versioned drafts, platform-specific previews, campaign calendar and content sources present |
| POST-04 | Approve exact social campaign | Version hash/channel/schedule/budget bound; only approved posts queued |
| POST-05 | Scheduled vs published | Scheduled records not shown as published until provider confirms URL/event |
| POST-06 | Cross-tenant channel ID injected | No posting or social analytics access to sibling account |
| POST-07 | Social app token revoked | Safe failure, retry/escalation without unauthorized repost |
| POST-08 | AI landing page or ad creative request | Real reviewable deliverable, version, asset/source rights, FREE included; page production path requires site approval |
| POST-09 | AI attempts change beyond approved content scope | New approval required, old approval cannot be reused |
| POST-10 | Public marketing/portal FREE badge | Clear prominent Marketing Studio FREE and no misleading paid software upsell |
| POST-11 | Ad spend | Customer separate explicit spend approval; free ad creative alone does not incur ad platform charge |

## E. SEO/analytics/competitors (P1)

| Test ID | Scenario | Pass condition |
|---|---|---|
| SEO-01 | GSC not connected | No fake ranking/traffic, clear Not Connected state |
| SEO-02 | GSC connected | Property/date/average-position and source/coverage labels correct |
| SEO-03 | GA4 vs GSC | Metrics not equated; both retain own source/date and definitions |
| SEO-04 | Google Places competitors | Correct market/category, no false keyword-rank claims |
| SEO-05 | Local rank provider absent | Rank grid says unavailable, never guessed from Places ordering |
| SEO-06 | AI says page published | Only after verified deployment/event and page inventory update |
| SEO-07 | Two same-group sites | Site-specific Google properties, market reports and competitor sets isolated |
| SEO-08 | SEO changes to regulated patient content | Human review/approved source required; no unsupported recruitment/medical claims |
| SEO-09 | External API quota/latency | Cached last measured data marked stale, bounded retries/cost |

## F. AI/agents, roles and automation (P0/P1)

| Test ID | Scenario | Pass condition |
|---|---|---|
| AGENT-01 | Paperclip internal Cursor agent test | Branch/PR and trace, budget cap, no direct production merge/deployment |
| AGENT-02 | Ten account-scoped receptionists | Independent knowledge, contact access, channels, locale, policies and cost visibility |
| AGENT-03 | Agent tries raw DB/credit charge/outbound mass send | No tool grant, rejected/audited |
| AGENT-04 | Prompt injection demands sibling contacts or PHI | Rejected; no unauthorized information in tool output |
| AGENT-05 | Agent pause/revoke | Pending work stopped or safely cancelled; no orphan side effects |
| AGENT-06 | AI storefront flag disabled | No purchase/provisioning route leak; architecture/catalog retained for future |
| AGENT-07 | Voice follow-up to lead with no AI voice consent | Denied; staff task/draft still available |
| AGENT-08 | Concurrent task provider failures | Idempotent retries, no duplicate sends/PRs/purchases |

## G. Compliance, infrastructure and accessibility (release gate)

- ACCESS-01: all API endpoints, service actions and workers re-check account/site/group membership independently of UI.
- ACCESS-02: payer can see group charges but not sibling notes/medical records unless distinct authorization.
- SECURITY-01: signed provider webhooks, replay rejection, encrypted credentials and token rotation verified.
- SECURITY-02: no secrets/PHI exposed in agent prompts, logs, source repo or provider test environment.
- INFRA-01: WebXXL and Stocksist production unaffected by isolated Docker deployment; health and capacity monitored.
- INFRA-02: backup and restore drill, failover/resume, dead-letter handling and cost alert tested.
- UX-01: EN/ES parity, keyboard/focus, mobile navigation, wallet/top-up approval, screen reader labels and error states.
- UX-02: existing immutable preview approval, owner review and separate domain cutover remain distinct.
- PERF-01: defined staged load for multi-tenant CRM/worker/webhook queues; cost/limits sustainable for FREE features.
- RELEASE-01: licenses/BAA/consent/platform approvals and chosen payment provider verified for enabled workflows before launch.

## Test execution ledger template

| Test ID | Build SHA | Environment | Run date | Result | Evidence | Owner | Notes |
|---|---|---|---|---|---|---|---|
| WAL-01 | TBD | staging | TBD | NOT RUN | TBD | Cursor | Do not mark pass without run |

**No test in this document has been executed by creating these Markdown files.**
