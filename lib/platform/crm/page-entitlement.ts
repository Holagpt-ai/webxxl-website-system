import { isCrmBackendEnabled } from '@/config/crm-backend'
import { splitLocale } from '@/lib/i18n/localize'
import { requireCustomerMembership } from '@/lib/portal/authz'
import {
  evaluateIncludedFreeAccessForAccount,
  type IncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import type { SubscriberEvidenceSnapshot } from '@/lib/platform/open001/subscriber-evidence'

/**
 * CRM page entitlement for Issue #105.
 *
 * Uses OPEN-001 `SUBSCRIBER_ONLY` and the authenticated CustomerAccount.
 * Subscription evidence is loaded only for that account. Payer-group membership
 * is not an input and does not grant CRM access.
 *
 * v0.app renders the bilingual locked state from this object. This module does
 * not render UI. The existing CRM API gate in `route-auth.ts` is unchanged.
 */
export const CRM_PAGE_ENTITLEMENT_KEY = 'core.crm' as const

/** Current CRM dashboard pages. The layout gate applies to every path here, including direct visits. */
export const CRM_DASHBOARD_PAGE_PATHS = [
  '/dashboard/crm',
  '/dashboard/crm/contacts',
  '/dashboard/crm/contacts/[contactId]',
  '/dashboard/crm/leads',
  '/dashboard/crm/leads/funnel',
  '/dashboard/crm/companies',
  '/dashboard/crm/pipeline',
  '/dashboard/crm/tasks',
  '/dashboard/crm/segments',
  '/dashboard/crm/import',
  '/dashboard/crm/settings',
  '/dashboard/crm/merges',
] as const

export type CrmDashboardPagePath = (typeof CRM_DASHBOARD_PAGE_PATHS)[number]

export type CrmPageEntitlementState = 'eligible' | 'subscription_required' | 'unavailable'

export type CrmPageEntitlementCode =
  | 'INCLUDED'
  | 'FREE_SOFTWARE_NOT_ELIGIBLE'
  | 'CRM_DISABLED'
  | 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE'
  | 'LEGACY_EVIDENCE_AMBIGUOUS'
  | 'POLICY_UNRESOLVED'
  | 'FORBIDDEN'

export type CrmPageLockedCopy = {
  title: string
  body: string
}

export type CrmPageEntitlement = {
  state: CrmPageEntitlementState
  code: CrmPageEntitlementCode
  httpStatus: 200 | 403 | 503
  /** Session CustomerAccount the decision was made for. Not a billing-group id. */
  customerAccountId: string
  /** False means v0 must not render the CRM workspace, subnav, children, or CRM records. */
  renderWorkspace: boolean
  /** True only for an eligible subscriber. Ineligible and unavailable states must not show the FREE badge. */
  showIncludedFreeBadge: boolean
  /** Bilingual locked explanation. Null only when `renderWorkspace` is true. */
  locked: { en: CrmPageLockedCopy; es: CrmPageLockedCopy } | null
}

const SUBSCRIPTION_REQUIRED_LOCKED = {
  en: {
    title: 'Active website subscription required',
    body: 'Included CRM for this customer account requires an active website subscription.',
  },
  es: {
    title: 'Se requiere una suscripción activa de sitio web',
    body: 'El CRM incluido para esta cuenta de cliente requiere una suscripción activa de sitio web.',
  },
} as const

const EVIDENCE_UNAVAILABLE_LOCKED = {
  en: {
    title: 'CRM is unavailable',
    body: 'Website subscription eligibility cannot be verified for this account, so CRM stays closed.',
  },
  es: {
    title: 'El CRM no está disponible',
    body: 'No se puede verificar la elegibilidad de la suscripción de sitio web para esta cuenta, así que el CRM permanece cerrado.',
  },
} as const

const MODULE_UNAVAILABLE_LOCKED = {
  en: {
    title: 'CRM is turned off',
    body: 'CRM is switched off in this environment, so no CRM data can be loaded.',
  },
  es: {
    title: 'El CRM está desactivado',
    body: 'El CRM está desactivado en este entorno, así que no se pueden cargar datos de CRM.',
  },
} as const

function closedEntitlement(
  customerAccountId: string,
  code: Exclude<CrmPageEntitlementCode, 'INCLUDED' | 'FREE_SOFTWARE_NOT_ELIGIBLE'>,
  httpStatus: 403 | 503,
  locked: { en: CrmPageLockedCopy; es: CrmPageLockedCopy },
): CrmPageEntitlement {
  return {
    state: 'unavailable',
    code,
    httpStatus,
    customerAccountId,
    renderWorkspace: false,
    showIncludedFreeBadge: false,
    locked,
  }
}

function subscriptionRequired(customerAccountId: string): CrmPageEntitlement {
  return {
    state: 'subscription_required',
    code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    httpStatus: 403,
    customerAccountId,
    renderWorkspace: false,
    showIncludedFreeBadge: false,
    locked: SUBSCRIPTION_REQUIRED_LOCKED,
  }
}

function eligible(customerAccountId: string): CrmPageEntitlement {
  return {
    state: 'eligible',
    code: 'INCLUDED',
    httpStatus: 200,
    customerAccountId,
    renderWorkspace: true,
    showIncludedFreeBadge: true,
    locked: null,
  }
}

/**
 * Map an OPEN-001 decision onto the page contract.
 * Missing or unverifiable evidence stays closed and is not reported as FREE access.
 */
export function crmPageEntitlementFromDecision(
  customerAccountId: string,
  decision: IncludedFreeAccessDecision,
): CrmPageEntitlement {
  if (decision.allowed) return eligible(customerAccountId)

  switch (decision.code) {
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
      return subscriptionRequired(customerAccountId)
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
      return closedEntitlement(
        customerAccountId,
        'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
        503,
        EVIDENCE_UNAVAILABLE_LOCKED,
      )
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return closedEntitlement(
        customerAccountId,
        'LEGACY_EVIDENCE_AMBIGUOUS',
        503,
        EVIDENCE_UNAVAILABLE_LOCKED,
      )
    case 'POLICY_UNRESOLVED':
      return closedEntitlement(customerAccountId, 'POLICY_UNRESOLVED', 503, EVIDENCE_UNAVAILABLE_LOCKED)
    case 'FORBIDDEN':
      return closedEntitlement(customerAccountId, 'FORBIDDEN', 403, MODULE_UNAVAILABLE_LOCKED)
    default:
      return closedEntitlement(
        customerAccountId,
        'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
        503,
        EVIDENCE_UNAVAILABLE_LOCKED,
      )
  }
}

export function evaluateCrmPageEntitlement(input: {
  customerAccountId: string
  crmBackendEnabled: boolean
  evidence: SubscriberEvidenceSnapshot
}): CrmPageEntitlement {
  if (!input.crmBackendEnabled) {
    return closedEntitlement(input.customerAccountId, 'CRM_DISABLED', 503, MODULE_UNAVAILABLE_LOCKED)
  }
  if (input.evidence.loadOutcome !== 'ok') {
    return closedEntitlement(
      input.customerAccountId,
      'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
      503,
      EVIDENCE_UNAVAILABLE_LOCKED,
    )
  }
  if (input.evidence.customerAccountId !== input.customerAccountId) {
    return closedEntitlement(
      input.customerAccountId,
      'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
      503,
      EVIDENCE_UNAVAILABLE_LOCKED,
    )
  }

  return crmPageEntitlementFromDecision(
    input.customerAccountId,
    evaluateIncludedFreeAccessForAccount({
      entitlementKey: CRM_PAGE_ENTITLEMENT_KEY,
      customerAccountId: input.customerAccountId,
      evidence: input.evidence,
    }),
  )
}

/** Session CustomerAccount only. Callers cannot pass an account id or a billing group. */
export async function resolveCrmPageEntitlement(): Promise<CrmPageEntitlement> {
  const portal = await requireCustomerMembership()
  const customerAccountId = portal.customerAccount.id
  if (!isCrmBackendEnabled()) {
    return closedEntitlement(customerAccountId, 'CRM_DISABLED', 503, MODULE_UNAVAILABLE_LOCKED)
  }
  const evidence = await loadSubscriberEvidenceForAccount(customerAccountId)
  return evaluateCrmPageEntitlement({
    customerAccountId,
    crmBackendEnabled: true,
    evidence,
  })
}

export function crmPageMayExposeRecords(entitlement: CrmPageEntitlement): boolean {
  return entitlement.state === 'eligible' && entitlement.renderWorkspace && entitlement.code === 'INCLUDED'
}

export function crmPageLockedCopy(
  entitlement: CrmPageEntitlement,
  locale: 'en' | 'es',
): CrmPageLockedCopy | null {
  if (!entitlement.locked) return null
  return entitlement.locked[locale]
}

function normalizedPath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] ?? '/'
  const { path } = splitLocale(bare)
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path || '/'
}

/** True for the overview and every current nested CRM page, in English or Spanish. */
export function isCrmDashboardPagePath(pathname: string): boolean {
  const path = normalizedPath(pathname)
  if ((CRM_DASHBOARD_PAGE_PATHS as readonly string[]).includes(path)) return true
  return /^\/dashboard\/crm\/contacts\/[^/]+$/.test(path)
}

/**
 * Overview and direct nested CRM URLs share one account decision.
 * A path outside the CRM page set stays closed.
 */
export function crmPageGateForPath(pathname: string, entitlement: CrmPageEntitlement): CrmPageEntitlement {
  if (!isCrmDashboardPagePath(pathname)) {
    return closedEntitlement(
      entitlement.customerAccountId,
      'POLICY_UNRESOLVED',
      503,
      EVIDENCE_UNAVAILABLE_LOCKED,
    )
  }
  return entitlement
}
