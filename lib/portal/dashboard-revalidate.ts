import { revalidatePath } from 'next/cache'

/** Locale-neutral dashboard module roots that must refresh after account / site context changes. */
export const CUSTOMER_DASHBOARD_LAYOUT_PATHS = [
  '/dashboard',
  '/es/dashboard',
  '/dashboard/business',
  '/es/dashboard/business',
  '/dashboard/project',
  '/es/dashboard/project',
  '/dashboard/crm',
  '/es/dashboard/crm',
  '/dashboard/marketing',
  '/es/dashboard/marketing',
  '/dashboard/seo',
  '/es/dashboard/seo',
  '/dashboard/analytics',
  '/es/dashboard/analytics',
  '/dashboard/communications',
  '/es/dashboard/communications',
  '/dashboard/billing',
  '/es/dashboard/billing',
  '/dashboard/marketplace',
  '/es/dashboard/marketplace',
  '/dashboard/ai-employees',
  '/es/dashboard/ai-employees',
  '/dashboard/notifications',
  '/es/dashboard/notifications',
  '/dashboard/settings/notifications',
  '/es/dashboard/settings/notifications',
] as const

export function revalidateCustomerDashboardLayouts(): void {
  for (const path of CUSTOMER_DASHBOARD_LAYOUT_PATHS) {
    revalidatePath(path, 'layout')
  }
}