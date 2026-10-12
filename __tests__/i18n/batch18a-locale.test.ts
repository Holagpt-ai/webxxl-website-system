import { describe, expect, it } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { switchLocaleHref } from '@/lib/i18n/localize'
import { parsePreferredLocale, resolveSignInLocale } from '@/lib/i18n/preference'
import { renderSystemNotification } from '@/lib/i18n/notifications'
import { localizeStoredActivity } from '@/lib/i18n/labels'
import { resolveEventContent } from '@/lib/automation/content'
import { buildAutomationEmail } from '@/lib/automation/templates/email'
import { parseMagicLinkEmailContext } from '@/lib/integrations/email'
import type { AutomationEvent } from '@prisma/client'

describe('batch 18a locale switching', () => {
  it('keeps the route and query when switching languages', () => {
    expect(switchLocaleHref('/dashboard/project', 'site=abmed', 'es')).toBe('/es/dashboard/project?site=abmed')
    expect(switchLocaleHref('/es/admin/projects/proj_1', 'tab=files', 'en')).toBe('/admin/projects/proj_1?tab=files')
    expect(switchLocaleHref('/es/dashboard/approvals', '', 'en')).toBe('/dashboard/approvals')
  })

  it('uses the saved preference on the default login URL and lets an explicit Spanish login win', () => {
    expect(parsePreferredLocale(undefined)).toBe('en')
    expect(parsePreferredLocale('fr')).toBe('en')
    expect(resolveSignInLocale('en', 'es')).toBe('es')
    expect(resolveSignInLocale('es', 'en')).toBe('es')
    expect(resolveSignInLocale('en', null)).toBe('en')
  })

  it('renders system notifications in the recipient language without translating user text', () => {
    const en = renderSystemNotification('en', 'newProjectMessage', { preview: 'Necesito el logo en PNG' })
    const es = renderSystemNotification('es', 'newProjectMessage', { preview: 'Need the logo as a PNG' })
    expect(en.title).toBe('New project message')
    expect(en.body).toBe('Necesito el logo en PNG')
    expect(es.title).toBe('Nuevo mensaje del proyecto')
    expect(es.body).toBe('Need the logo as a PNG')

    const status = renderSystemNotification('es', 'serviceOrderStatusUpdated', { publicId: 'SO-1', status: 'QUOTED' })
    expect(status.body).toContain('Cotizada')
    expect(status.body).toContain('SO-1')
  })

  it('localizes activity prefixes and leaves the stored detail', () => {
    const labels = getDictionary('es').dashboard.activityLabels
    expect(localizeStoredActivity('File uploaded: logo.png', 'FILE_UPLOADED', labels)).toBe('Archivo subido: logo.png')
  })

  it('resolves automation copy from the recipient locale, not a stored English title', () => {
    const event = {
      eventType: 'PROJECT_CREATED',
      payload: {
        templateKey: 'projectCreated',
        templateVars: { projectName: 'ABMED' },
        title: 'New project started',
        body: 'English fallback',
        actionUrl: '/dashboard/project',
      },
    } as unknown as AutomationEvent
    const es = resolveEventContent(event, 'es')
    expect(es.title).toBe('Nuevo proyecto iniciado')
    expect(es.body).toContain('ABMED')
    expect(es.body).not.toContain('English fallback')
    expect(es.locale).toBe('es')
  })

  it('builds Spanish email chrome and detects Spanish sign-in links', () => {
    const mail = buildAutomationEmail({
      locale: 'es',
      title: 'Aprobación solicitada',
      body: 'Homepage',
      actionUrl: '/es/dashboard/approvals',
    })
    expect(mail.text).toContain('transaccional')
    expect(mail.text).toContain('Abrir en el portal')
    expect(mail.text).toContain('Homepage')

    expect(
      parseMagicLinkEmailContext('https://www.webbxxl.com/api/auth/callback/email?callbackUrl=%2Fes%2Fdashboard'),
    ).toEqual({ kind: 'sign_in', locale: 'es' })
  })

  it('keeps admin and customer dictionaries aligned', () => {
    const en = getDictionary('en')
    const es = getDictionary('es')
    expect(Object.keys(es.admin.nav).sort()).toEqual(Object.keys(en.admin.nav).sort())
    expect(Object.keys(es.systemNotifications).sort()).toEqual(Object.keys(en.systemNotifications).sort())
    expect(es.dashboard.signOut).not.toBe(en.dashboard.signOut)
  })
})
