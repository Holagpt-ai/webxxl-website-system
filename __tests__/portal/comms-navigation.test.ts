import { describe, expect, it } from 'vitest'
import { getDashboardNavModules } from '@/lib/portal/modules'
import { en } from '@/lib/i18n/dictionaries/en'
import { es } from '@/lib/i18n/dictionaries/es'

describe('communications dashboard navigation', () => {
  it('registers Communications without replacing project messages', () => {
    const nav = getDashboardNavModules()
    const messages = nav.find((m) => m.route === '/dashboard/messages')
    const comms = nav.find((m) => m.route === '/dashboard/communications')
    expect(messages?.navLabel).toBe('messages')
    expect(comms).toMatchObject({
      key: 'communications',
      navLabel: 'communications',
      route: '/dashboard/communications',
      icon: 'headphones',
      enabled: true,
    })
  })

  it('provides EN and ES portal labels', () => {
    expect(en.dashboard.nav.communications).toBe('Communications')
    expect(es.dashboard.nav.communications).toBe('Comunicaciones')
    expect(en.dashboard.nav.messages).not.toBe(en.dashboard.nav.communications)
  })
})
