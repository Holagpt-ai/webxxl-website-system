export type ProviderCapabilityResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: 'unavailable' | 'read_only' | 'not_configured' }

export interface HostingProvider {
  id: string
  fetchServiceInfo(externalRef: string): Promise<ProviderCapabilityResult>
  checkServiceStatus(externalRef: string): Promise<ProviderCapabilityResult>
  requestProvisioning(): Promise<ProviderCapabilityResult>
  requestRenewal(): Promise<ProviderCapabilityResult>
  synchronize(): Promise<ProviderCapabilityResult>
}

export interface DomainRegistrarProvider {
  id: string
  fetchDomainInfo(externalRef: string): Promise<ProviderCapabilityResult>
  requestRegistration(): Promise<ProviderCapabilityResult>
  requestTransfer(): Promise<ProviderCapabilityResult>
  requestRenewal(): Promise<ProviderCapabilityResult>
  synchronize(): Promise<ProviderCapabilityResult>
}

export interface DnsProvider {
  id: string
  fetchDnsRecords(domain: string): Promise<ProviderCapabilityResult>
  requestModification(): Promise<ProviderCapabilityResult>
  synchronize(): Promise<ProviderCapabilityResult>
}

export interface EmailProvider {
  id: string
  fetchMailboxInfo(externalRef: string): Promise<ProviderCapabilityResult>
  requestSetup(): Promise<ProviderCapabilityResult>
  requestMailboxAddition(): Promise<ProviderCapabilityResult>
  requestRenewal(): Promise<ProviderCapabilityResult>
  synchronize(): Promise<ProviderCapabilityResult>
}
