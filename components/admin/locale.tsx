'use client'

import { createContext, useContext } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

const AdminLocaleContext = createContext<Locale>('en')

export function AdminLocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <AdminLocaleContext.Provider value={locale}>{children}</AdminLocaleContext.Provider>
}

export function useAdminCopy() {
  const locale = useContext(AdminLocaleContext)
  const dict = getDictionary(locale)
  return { locale, admin: dict.admin, dashboard: dict.dashboard, notifications: dict.systemNotifications }
}
