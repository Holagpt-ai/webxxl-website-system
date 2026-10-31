import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { isCommsBackendEnabled } from '@/config/comms-backend'
import { isCrmBackendEnabled } from '@/config/crm-backend'
import { isMktBackendEnabled } from '@/config/mkt-backend'
import { isSeoBackendEnabled } from '@/config/seo-backend'
import { isSiteLeadIntakeEnabled } from '@/config/site-lead-intake'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isOpen001PolicyResolved } from '@/lib/platform/open001/policy'

/** Customer-visible readiness — not production activation proof. */
export type FeatureReadinessState =
  | 'disabled'
  | 'not_configured'
  | 'policy_unresolved'
  | 'unauthorized'
  | 'ready_pending_migration'
  | 'ready_pending_data'

export type FeatureReadinessRow = {
  id: string
  label: string
  backendFlag: string
  flagEnabled: boolean
  entitlementKey?: string
  typicalCustomerState: FeatureReadinessState
  notes: string
}

function entitlementState(key: string): FeatureReadinessState {
  if (!isOpen001PolicyResolved()) return 'policy_unresolved'
  const ent = getServiceEntitlement(key)
  if (!ent) return 'not_configured'
  const access = evaluateEntitlementAccess(ent)
  if (access.access === 'POLICY_UNRESOLVED') return 'policy_unresolved'
  if (access.access === 'DENIED') return 'unauthorized'
  return 'ready_pending_migration'
}

function moduleState(flagEnabled: boolean, entitlementKey?: string): FeatureReadinessState {
  if (entitlementKey) {
    const ent = entitlementState(entitlementKey)
    if (ent !== 'ready_pending_migration') return ent
  }
  if (!flagEnabled) return 'disabled'
  return 'ready_pending_migration'
}

/** Static matrix for current process environment (CI/local). Production values UNVERIFIED unless probed. */
export function buildFeatureReadinessMatrix(): FeatureReadinessRow[] {
  return [
    {
      id: 'crm',
      label: 'CRM',
      backendFlag: 'CRM_BACKEND_ENABLED',
      flagEnabled: isCrmBackendEnabled(),
      entitlementKey: 'core.crm',
      typicalCustomerState: moduleState(isCrmBackendEnabled(), 'core.crm'),
      notes: 'Includes Lead Inbox when site-lead tables exist; flag OFF by default.',
    },
    {
      id: 'site_lead_intake',
      label: 'Managed-site lead intake',
      backendFlag: 'SITE_LEAD_INTAKE_ENABLED',
      flagEnabled: isSiteLeadIntakeEnabled(),
      typicalCustomerState: isSiteLeadIntakeEnabled() ? 'ready_pending_migration' : 'disabled',
      notes: 'Reporting (`funnel-report`) does not require intake flag; live form POST does.',
    },
    {
      id: 'marketing',
      label: 'Marketing Studio',
      backendFlag: 'MKT_BACKEND_ENABLED',
      flagEnabled: isMktBackendEnabled(),
      entitlementKey: 'core.marketing-studio',
      typicalCustomerState: moduleState(isMktBackendEnabled(), 'core.marketing-studio'),
      notes: 'No live publish/send without separate provider flags.',
    },
    {
      id: 'local_seo',
      label: 'Local SEO',
      backendFlag: 'SEO_BACKEND_ENABLED',
      flagEnabled: isSeoBackendEnabled(),
      entitlementKey: 'core.local-seo',
      typicalCustomerState: moduleState(isSeoBackendEnabled(), 'core.local-seo'),
      notes: 'Stored read APIs; live Google/crawl OFF at source defaults.',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      backendFlag: 'ANALYTICS_BACKEND_ENABLED',
      flagEnabled: isAnalyticsBackendEnabled(),
      typicalCustomerState: isAnalyticsBackendEnabled() ? 'ready_pending_migration' : 'disabled',
      notes: 'Dashboard + ingestion flags separate; ingestion default OFF.',
    },
    {
      id: 'communications',
      label: 'Communications',
      backendFlag: 'COMMS_BACKEND_ENABLED',
      flagEnabled: isCommsBackendEnabled(),
      entitlementKey: 'core.communications',
      typicalCustomerState: moduleState(isCommsBackendEnabled(), 'core.communications'),
      notes: 'Inbox software ≠ SMS/email send; outbound flags remain OFF.',
    },
    {
      id: 'business_command_center',
      label: 'Business Command Center',
      backendFlag: '(read-only overview API)',
      flagEnabled: true,
      typicalCustomerState: 'ready_pending_data',
      notes: '`GET /api/v1/business/overview` — module slices fail independently; no separate activation flag.',
    },
  ]
}
