import { WEBXXL_RECORDED_STAGING_SUPABASE_REF } from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type StagingPilotOperatorChecklist = {
  stagingDatabaseRef: string
  vercelPreview: string[]
  authentication: string[]
  fixtureProvisioning: string[]
  moduleFlags: string[]
  enEsSmoke: string[]
  remainingForFirstCrmPilot: string[]
}

/** Concise operator steps — no secrets. */
export function buildStagingPilotOperatorChecklist(): StagingPilotOperatorChecklist {
  return {
    stagingDatabaseRef: WEBXXL_RECORDED_STAGING_SUPABASE_REF,
    vercelPreview: [
      'Open the Vercel Preview deployment for main and confirm DATABASE_URL + DIRECT_URL point at staging Supabase only.',
      'Set WEBXXL_STAGING_DATABASE_IDENTITY=supabase:vcgibefnhneaqhcguhnt/postgres and WEBXXL_PRODUCTION_DATABASE_IDENTITY=supabase:txfxeehglqfszletuumn/postgres.',
      'After verifying project refs differ, set WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1 on that Preview environment.',
      'Set AUTH_URL to the exact preview URL and AUTH_SECRET in Vercel env only (never commit).',
    ],
    authentication: [
      'Configure Auth.js email or OAuth on the preview host so pilot-staging-a@staging.webxxl.invalid and pilot-staging-b@staging.webxxl.invalid can sign in.',
      'This repository creates User rows only; it does not mint login credentials or bypass authentication.',
    ],
    fixtureProvisioning: [
      'Run pnpm pilot:staging-fixture-provision (dry-run) with staging DATABASE_URL set to inspect existing pilot rows.',
      'When authorized: set WEBXXL_STAGING_PILOT_FIXTURE_APPLY_AUTHORIZED=1 and run with --apply --confirm-staging-provision (staging only).',
      'Confirm acct_pilot_staging_a has ACTIVE website.subscription on the same account; acct_pilot_staging_b has membership only.',
    ],
    moduleFlags: [
      'Keep provider and outbound flags OFF on preview.',
      'Enable CRM_BACKEND_ENABLED=1 on preview first; leave MKT, SEO, COMMS, and ANALYTICS backend flags OFF until planned.',
    ],
    enEsSmoke: [
      'Sign in as pilot A (English) and open CRM read paths on acct_pilot_staging_a.',
      'Switch locale to Spanish and repeat navigation on the same account.',
      'Sign in as pilot B and confirm free-module APIs stay blocked (403) when CRM flag is on.',
      'Verify account switching does not leak data between A and B.',
    ],
    remainingForFirstCrmPilot: [
      'Staging schema 39/39 (recorded) — no further migration recovery in this gate.',
      'Preview app bound to staging DB with AUTH_URL configured.',
      'Pilot fixture rows applied on staging (authorized apply).',
      'CRM_BACKEND_ENABLED=1 on preview only.',
      'Successful authenticated EN/ES smoke recorded by owner.',
    ],
  }
}
