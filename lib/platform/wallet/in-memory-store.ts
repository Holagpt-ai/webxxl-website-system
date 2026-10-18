import type { OperatingMembership } from '@/lib/platform/billing-authz'
import type {
  BillingGroupMembershipRecord,
  BillingGroupRecord,
  BillingGroupRoleRecord,
  BillingProfileRecord,
  CreditReservationRecord,
  CreditWalletRecord,
  MessageUsageRecord,
  SiteSpendingPolicyRecord,
  WalletLedgerEntryRecord,
} from '@/lib/platform/wallet/types'

export type OperatingAccountRecord = {
  id: string
  businessName: string
  slug: string
}

export type ManagedSiteIdentity = {
  id: string
  customerAccountId: string
  name: string
}

export type AgentConfigIdentity = {
  id: string
  customerAccountId: string
  managedSiteId: string
  kind: string
  enabled: false
}

export type InMemoryPlatformStore = {
  users: Map<string, { id: string; email: string }>
  accounts: Map<string, OperatingAccountRecord>
  operatingMemberships: OperatingMembership[]
  sites: ManagedSiteIdentity[]
  agentConfigs: AgentConfigIdentity[]
  groups: Map<string, BillingGroupRecord>
  memberships: BillingGroupMembershipRecord[]
  roles: BillingGroupRoleRecord[]
  profiles: BillingProfileRecord[]
  wallets: Map<string, CreditWalletRecord>
  ledger: WalletLedgerEntryRecord[]
  reservations: CreditReservationRecord[]
  policies: SiteSpendingPolicyRecord[]
  usage: MessageUsageRecord[]
  /** Server-configured automation identities allowed to act as wallet SERVICE actors. */
  trustedWalletServiceActors: Set<string>
}

export function createEmptyPlatformStore(): InMemoryPlatformStore {
  return {
    users: new Map(),
    accounts: new Map(),
    operatingMemberships: [],
    sites: [],
    agentConfigs: [],
    groups: new Map(),
    memberships: [],
    roles: [],
    profiles: [],
    wallets: new Map(),
    ledger: [],
    reservations: [],
    policies: [],
    usage: [],
    trustedWalletServiceActors: new Set(),
  }
}

export function nextId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`
}
