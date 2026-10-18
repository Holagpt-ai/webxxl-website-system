# 08 — FREE Marketing Studio, Postiz Activation & AI Creative Production

**Current baseline:** `lib/integrations/scheduler.ts` exposes Postiz scheduler URL default `https://app.webbxxl.com`, HEAD health and external link. **SOCIAL-04 (2026-10-18)** adds `lib/platform/social/*`, typed Postiz Public API adapter (`postiz-social.ts`, reference app pin **v2.25.1**), campaign/approval/scheduling gateway, and Prisma migration `20261018170000_social04_marketing_studio`. **SOCIAL-04A (2026-10-18)** hardens tenant boundaries: Postiz integration lists are intersected with per-account `BusinessSocialConnection` allowlists (`postiz-isolation.ts`); Prisma campaign creation uses quota + idempotency (`campaign-create-service.ts`, migration `20261018180000_social04a_integrity`); revision hashes include media/payloads/channels/schedule via `revision-content.ts`; scheduling idempotency binds account/campaign/revision/approval/channel/time/content hash and fails closed at the gateway when live publishing flags are off. **Live Postiz publishing remains NOT ACTIVATED** (`POSTIZ_LIVE_PUBLISHING_ENABLED=false`). Deployed Postiz version/API credentials and connected social platforms at app.webbxxl.com remain **UNVERIFIED**. FREE Marketing Studio software fee policy (**OPEN-001** eligibility) is unchanged.

## 1. FREE Marketing Studio product scope

**Prominent `[ FREE ]` badge in dashboard navigation/title and marketing positioning.** CRM, local SEO visibility, social scheduling, AI campaign planning/setup, landing-page content/implementation proposals and ad creative preparation are included in the WebXXL website value proposition at no separate software service fee. Third-party advertising spend, domain/hosting/email fees, SMS and charged carrier/API usage stay distinct. Customer eligibility and included fair-use quotas are configurable; the precise free prospect/subscriber enrollment policy remains open.

Capabilities: AI-led onboarding brief; goal/audience/locale/brand intake; campaign plans; multi-platform captions and images/assets as permitted; scheduled social posts; SEO landing-page drafts, variants and staged PRs; ad copy/creative drafts; performance reports; account-scoped deliverable inbox; revision loops; evidence-backed result metrics; human approval and publishing controls. Every output has an immutable revision and business/site association.

## 2. Postiz activation checklist

1. Determine actual Docker/Hostinger Postiz instance version, repo/template source, container health, database, Redis and worker state **without changing Stocksist services**.
2. Validate `https://app.webbxxl.com` resolves to intended service with TLS; verify server auth and Postiz API documentation for exact deployed version; do not confuse availability HEAD with integrated authentication.
3. Establish service-level API credentials and per-customer social channel mapping; verify whether the chosen edition/deployment offers safe multi-workspace isolation. If not, design separate instance/workspace per customer behind `SocialPublisherProvider` without dropping functionality.
4. Complete necessary external developer applications and OAuth approvals (Meta, LinkedIn, YouTube, TikTok, X, etc.) **per platform** as needed, with tested refresh/revocation flows. Do not mark channel connected merely because a button exists.
5. Implement WebXXL server-only Postiz adapter for channel discovery, media upload, create/schedule, status polling/callback, delete/cancel/review and analytics if supported. Use exact deployed API schema rather than inventing endpoints.
6. Postiz owns actual post execution/scheduling. WebXXL owns campaign brief, approvals, customer permissions, AI credits/cost guardrails and outcome reports; durable jobs synchronize status, do not duplicate native Postiz scheduled execution.
7. Run synthetic accounts and nonpublic/test posts before live customer permissions, and prove no cross-account social publishing.
8. Confirm AGPL/network deployment and any commercial embedding/white-label/API terms with actual version. Document license compliance. No unapproved clone-and-edit in WebXXL codebase.

## 3. Campaign sequence and evidence

```
Customer chooses Business + Site -> approved channels + goal/market/audience
  -> AI collects allowed knowledge, writing constraints, brand tone and assets
  -> drafts weekly/monthly plan, variants, post schedule and ad creative
  -> policy checks legal claims, permission, budget, image rights, allowed platforms
  -> immutable artifact hash and preview (EN/ES where configured)
  -> customer/staff approves content, channels, times and allowed ongoing autonomy
  -> WebXXL creates published schedule in Postiz via scoped adapter
  -> Postiz returns scheduled external post ID (not treated as PUBLISHED)
  -> after publication, actual post URL/status imported with timestamp
  -> analytics fetched on provider-supported cadence, source-tagged
  -> AI recommends next changes; new materially different scope requires new approval
```

For recurring campaigns, authorized policy can allow minor approved-template variations inside an explicit scope (brand voice, channel, max posts/week, spend zero, allowed content categories). Promotions, new healthcare eligibility claims, ad spend, new channels or major content changes require new approval. Publication is never inferred from successful scheduling.

## 4. Business social identities vs individual contacts

When ABMED links its Instagram through Postiz, it updates the **business** social connection and optionally company CRM social fields. It **must not** bulk import followers as contacts. Individual people become CRM contacts only after eligible inbound contact/authorized import with provenance; social DMs use supported Chatwoot providers, account-scoped identity links and consent rules. Account mapping precedence is WebXXL CustomerAccount → Postiz workspace/connector → external social channel ID.

## 5. Landing pages and page lifecycle

A free landing-page request creates `MarketingRequest` → AI brief + content design → `MarketingArtifact` → review of brand/compliance/SEO → Cursor/GitHub PR or supported managed-site change through existing `ManagedSiteChange` flow → immutable preview/version → owner approval → separately authorized deployment (and DNS cutover if applicable) → site page inventory and SEO measured outcomes. **Marketing Studio does not circumvent WebXXL project approvals or bypass v0 UI ownership**. Actual requested creative may require generated imagery; record license/source/provenance. New web pages must be useful and accurate, avoiding thin mass-generated spam and unfounded medical promises.

## 6. Ad creative and campaign setup

Free AI generates conceptual media, variant copy, landing-page alignment, target audience concepts and measurement plan. Connecting Google Ads/Meta Ads account and actually launching paid campaigns is a **separate approval and customer-funded spend** with explicit identity, budget, duration and purchase policy. No AI agent can modify paid campaign budgets or create charges from an unapproved prompt. Import performance via ad platform analytics only once provider app scopes/permissions are approved.

## 7. UI requirements

Marketing Studio main dashboard includes FREE badge, New Request, Landing Pages, Ad Creative, Social Campaign, Local SEO Fix, Recent Agent Activity, Deliverables Awaiting Review, Approved/Scheduled, real published status and errors. Social subpage: connected channel chips with actual authorized state, month/week calendar, preview, revision history, campaigns, post URLs/analytics and retry/error escalation. Mobile agenda, EN/ES and appropriate empty states mandatory.

## 8. Run-time and cost safeguards

- Per site/account quotas and fair scheduling for image generation, tokens, draft volume, social API calls and uploads; no hidden customer charges.
- Queue high-cost tasks with cost ceilings; keep owner-visible limits for product profitability.
- Honor external social platform rate limits and content policies; approved posts only, with token refresh and failure diagnostics.
- WebXXL may use Hatchet for preparation/sync and repair jobs, while Postiz independently schedules/releases social posts.
- Clear statuses: `NOT_CONNECTED`, `DRAFT`, `AWAITING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`; never display false timestamps or fake reach.

## 9. Acceptance

- Three synthetic ABMED accounts, independent Postiz mappings; a request from account A cannot schedule on B's Instagram.
- User sees FREE badge and $0 software line for Marketing Studio; any third-party cost clearly distinguished.
- AI creates a traceable 30-day posting plan, customer approves exact content scope, Postiz scheduled IDs are captured; test post shows actual external publication proof.
- Revoking a platform token moves only affected channels to `NOT_CONNECTED` and prevents accidental autopost.
- Landing page/creative requires actual artifact, review and production version approval; no fabricated published pages.
