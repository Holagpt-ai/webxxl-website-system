import type { DnsProvider, DomainRegistrarProvider, EmailProvider, HostingProvider, ProviderCapabilityResult } from '@/lib/infrastructure/providers/types'

const unavailable = (): Promise<ProviderCapabilityResult> =>
  Promise.resolve({ ok: false, error: 'unavailable' })

function stubHosting(id: string): HostingProvider {
  return {
    id,
    fetchServiceInfo: unavailable,
    checkServiceStatus: unavailable,
    requestProvisioning: unavailable,
    requestRenewal: unavailable,
    synchronize: unavailable,
  }
}

function stubRegistrar(id: string): DomainRegistrarProvider {
  return {
    id,
    fetchDomainInfo: unavailable,
    requestRegistration: unavailable,
    requestTransfer: unavailable,
    requestRenewal: unavailable,
    synchronize: unavailable,
  }
}

function stubDns(id: string): DnsProvider {
  return {
    id,
    fetchDnsRecords: unavailable,
    requestModification: unavailable,
    synchronize: unavailable,
  }
}

function stubEmail(id: string): EmailProvider {
  return {
    id,
    fetchMailboxInfo: unavailable,
    requestSetup: unavailable,
    requestMailboxAddition: unavailable,
    requestRenewal: unavailable,
    synchronize: unavailable,
  }
}

export function getHostingProvider(providerId: string): HostingProvider {
  return stubHosting(providerId || 'manual')
}

export function getDomainRegistrarProvider(providerId: string): DomainRegistrarProvider {
  return stubRegistrar(providerId || 'manual')
}

export function getDnsProvider(providerId: string): DnsProvider {
  return stubDns(providerId || 'manual')
}

export function getEmailProvider(providerId: string): EmailProvider {
  return stubEmail(providerId || 'manual')
}
