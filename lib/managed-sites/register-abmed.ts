import { ABMED_MANAGED_SITE_PROFILES, type AbmedManagedSiteProfile } from '@/lib/managed-sites/abmed'
import { prisma } from '@/lib/db'

export type AbmedRegistrationPlan =
  | {
      ok: true
      customerAccountId: string
      create: AbmedManagedSiteProfile[]
      existing: string[]
    }
  | { ok: false; error: 'customer_not_found' | 'domain_taken'; domain?: string }

export function planAbmedRegistration(input: {
  customerAccountId: string | null
  existingSites: { domain: string; customerAccountId: string }[]
}): AbmedRegistrationPlan {
  if (!input.customerAccountId) return { ok: false, error: 'customer_not_found' }
  const create: AbmedManagedSiteProfile[] = []
  const existing: string[] = []
  for (const profile of ABMED_MANAGED_SITE_PROFILES) {
    const found = input.existingSites.find((site) => site.domain === profile.domain)
    if (!found) {
      create.push(profile)
      continue
    }
    if (found.customerAccountId !== input.customerAccountId) {
      return { ok: false, error: 'domain_taken', domain: profile.domain }
    }
    existing.push(profile.domain)
  }
  return { ok: true, customerAccountId: input.customerAccountId, create, existing }
}

export async function registerAbmedManagedSites(input: {
  customerAccountId: string
  dryRun?: boolean
}): Promise<AbmedRegistrationPlan & { written?: string[] }> {
  const account = await prisma.customerAccount.findUnique({ where: { id: input.customerAccountId }, select: { id: true } })
  const domains = ABMED_MANAGED_SITE_PROFILES.map((profile) => profile.domain)
  const existingSites = await prisma.managedSite.findMany({
    where: { domain: { in: domains } },
    select: { domain: true, customerAccountId: true },
  })
  const plan = planAbmedRegistration({
    customerAccountId: account?.id ?? null,
    existingSites,
  })
  if (!plan.ok || input.dryRun) return plan
  const written: string[] = []
  for (const profile of plan.create) {
    const site = await prisma.managedSite.create({
      data: {
        customerAccountId: plan.customerAccountId,
        name: profile.name,
        domain: profile.domain,
        canonicalUrl: profile.canonicalUrl,
        status: 'SETUP',
        platform: profile.platform,
        locale: profile.locale,
        connectionType: profile.connectionType,
        adapterKey: profile.adapterKey,
        externalAdminUrl: profile.externalAdminUrl,
        capabilities: {
          create: profile.capabilityKeys.map((capabilityKey) => ({
            capabilityKey,
            enabled: true,
          })),
        },
      },
    })
    written.push(site.domain)
  }
  return { ...plan, written }
}
