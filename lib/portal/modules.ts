import type { IconName } from '@/lib/icons'
import { isEnabled } from '@/config/features'

export type PortalModuleKey =
  | 'project'
  | 'sites'
  | 'files'
  | 'messages'
  | 'approvals'
  | 'changeRequests'
  | 'support'
  | 'services'
  | 'scheduler'
  | 'hosting'
  | 'domains'
  | 'email'
  | 'crm'
  | 'marketingStudio'
  | 'billing'
  | 'seo'
  | 'ecommerce'
  | 'analytics'
  | 'ai'

export type PortalModule = {
  key: PortalModuleKey
  navLabel: string
  route?: string
  icon: IconName
  enabled: boolean
  entitlementRequired?: string
  statusSource?: 'customerService' | 'project' | 'static'
}

const REGISTRY: PortalModule[] = [
  { key: 'project', navLabel: 'project', route: '/dashboard/project', icon: 'kanban', enabled: true, statusSource: 'project' },
  { key: 'sites', navLabel: 'sites', route: '/dashboard/sites', icon: 'globe', enabled: true },
  { key: 'files', navLabel: 'files', route: '/dashboard/files', icon: 'file', enabled: true },
  { key: 'messages', navLabel: 'messages', route: '/dashboard/messages', icon: 'message', enabled: true },
  { key: 'approvals', navLabel: 'approvals', route: '/dashboard/approvals', icon: 'shield', enabled: true },
  { key: 'changeRequests', navLabel: 'requests', route: '/dashboard/requests', icon: 'refresh', enabled: true },
  { key: 'support', navLabel: 'support', route: '/dashboard/support', icon: 'lifebuoy', enabled: true },
  { key: 'services', navLabel: 'services', route: '/dashboard/services', icon: 'layers', enabled: true },
  { key: 'scheduler', navLabel: 'scheduler', icon: 'megaphone', enabled: true, entitlementRequired: 'scheduler', statusSource: 'customerService' },
  { key: 'hosting', navLabel: 'hosting', icon: 'server', enabled: false, entitlementRequired: 'hosting', statusSource: 'customerService' },
  { key: 'domains', navLabel: 'domains', icon: 'globe', enabled: false, entitlementRequired: 'domains', statusSource: 'customerService' },
  { key: 'email', navLabel: 'email', icon: 'mail', enabled: false, entitlementRequired: 'email', statusSource: 'customerService' },
  { key: 'crm', navLabel: 'crm', icon: 'contact', enabled: false, entitlementRequired: 'crm', statusSource: 'customerService' },
  {
    key: 'marketingStudio',
    navLabel: 'marketingStudio',
    icon: 'megaphone',
    enabled: false,
    entitlementRequired: 'marketing',
    statusSource: 'customerService',
  },
  { key: 'billing', navLabel: 'billing', icon: 'card', enabled: false, statusSource: 'static' },
  { key: 'seo', navLabel: 'seo', icon: 'search', enabled: false, entitlementRequired: 'seo', statusSource: 'customerService' },
  { key: 'ecommerce', navLabel: 'ecommerce', icon: 'cart', enabled: false, entitlementRequired: 'ecommerce', statusSource: 'customerService' },
  { key: 'analytics', navLabel: 'analytics', icon: 'chart', enabled: false, entitlementRequired: 'analytics', statusSource: 'customerService' },
  { key: 'ai', navLabel: 'ai', icon: 'sparkles', enabled: false, entitlementRequired: 'ai', statusSource: 'customerService' },
]

export function getPortalModuleRegistry(): PortalModule[] {
  return REGISTRY
}

export function getDashboardNavModules(): PortalModule[] {
  const core = REGISTRY.filter((m) =>
    ['sites', 'files', 'messages', 'approvals', 'changeRequests', 'support', 'services'].includes(m.key),
  )
  const infrastructureNav: PortalModule[] = isEnabled('infrastructureManagement')
    ? [{ key: 'hosting', navLabel: 'infrastructure', route: '/dashboard/infrastructure', icon: 'server', enabled: true }]
    : []
  const automationNav: PortalModule[] = isEnabled('automationNotifications')
    ? [
        { key: 'support', navLabel: 'notifications', route: '/dashboard/notifications', icon: 'lifebuoy', enabled: true },
        { key: 'support', navLabel: 'notificationSettings', route: '/dashboard/settings/notifications', icon: 'shield', enabled: true },
      ]
    : []
  return [
    { key: 'project', navLabel: 'overview', route: '/dashboard', icon: 'dashboard', enabled: true },
    { key: 'project', navLabel: 'project', route: '/dashboard/project', icon: 'kanban', enabled: true },
    ...core,
    { key: 'ecommerce', navLabel: 'marketplace', route: '/dashboard/marketplace', icon: 'cart', enabled: true },
    { key: 'billing', navLabel: 'billingCredits', route: '/dashboard/billing', icon: 'card', enabled: true },
    { key: 'analytics', navLabel: 'analytics', route: '/dashboard/analytics', icon: 'chart', enabled: true },
    { key: 'crm', navLabel: 'crm', route: '/dashboard/crm', icon: 'contact', enabled: true },
    { key: 'marketingStudio', navLabel: 'marketingStudio', route: '/dashboard/marketing', icon: 'megaphone', enabled: true },
    { key: 'seo', navLabel: 'seo', route: '/dashboard/seo', icon: 'search', enabled: true },
    { key: 'ai', navLabel: 'aiEmployees', route: '/dashboard/ai-employees', icon: 'bot', enabled: true },
    ...infrastructureNav,
    ...automationNav,
  ]
}

export function getServiceModules(activeServiceKeys: Set<string>): PortalModule[] {
  return REGISTRY.filter((m) => m.statusSource === 'customerService' || m.key === 'billing').map((m) => {
    if (!m.entitlementRequired) return m
    return { ...m, enabled: activeServiceKeys.has(m.entitlementRequired) }
  })
}
