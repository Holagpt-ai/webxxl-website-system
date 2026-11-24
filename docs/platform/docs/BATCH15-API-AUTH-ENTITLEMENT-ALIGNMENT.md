# BATCH 15 — API authorization & entitlement alignment

**Status:** IN PR [PR **#152**](https://github.com/Holagpt-ai/webxxl-website-system/pull/152) @ `e81cce870f44cd6c97a2061e9a4f42f6ac3e4dce` · **Baseline:** `main` @ `061113b203779784674bf05b852361d71f388f08` (PR **#151** MERGED Batch 14).

## Scope

Closes Batch 16 §7 gaps for stable `{ code, message }` on unauthenticated customer API calls and OPEN-001 ordering on Social routes. No flag, eligibility, or business-logic changes.

## Delivery

| Family | Helper | Routes |
|---|---|---|
| CRM | `lib/platform/crm/http.ts` → `crmRouteError` | All `app/api/v1/crm/**` customer handlers |
| Marketing | `mktRouteError` (+ `AuthError` → `401`) | Existing marketing routes + `marketing/execution/summary` |
| SEO | `seoRouteError` | Legacy SEO site handlers + google readiness assess |
| Communications | `commsRouteError` | Legacy comms handlers + execution summary |
| Social | `lib/platform/social/http.ts` → `socialRouteError` | All `app/api/v1/social/**` handlers |

### OPEN-001 (Social)

`requireSocialApiActor` now runs `requireIncludedFreeSoftwareMembershipKeys` **before** `SOCIAL_MARKETING_ENABLED`, so `POLICY_UNRESOLVED` / evidence failures return documented **503** envelopes instead of being masked by the social disabled **403**.

## Gates (unchanged)

Backend flags, OPEN-001 evidence rules, and permission matrices are untouched.

## Tests

`__tests__/platform/batch15-api-auth-alignment.test.ts`

## Deferred

- Non-customer execution routes outside the four workspace families (e.g. workflow worker).
- AUTH-STAGING-8C browser matrix.