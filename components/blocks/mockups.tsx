import Image from 'next/image'
import {
  BarChart3,
  Bell,
  Calendar,
  Clock,
  Contact,
  Globe,
  Handshake,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react'
import type { ServiceVisual } from '@/content/services'
import type { Locale } from '@/lib/i18n/config'
import { t, type Localized } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'

const L = (en: string, es: string): Localized => ({ en, es })

const crmNav = [
  { icon: LayoutDashboard, label: L('Dashboard', 'Panel') },
  { icon: Contact, label: L('Contacts', 'Contactos') },
  { icon: Handshake, label: L('Deals', 'Negocios') },
  { icon: Send, label: L('Campaigns', 'Campañas') },
  { icon: MessageSquare, label: L('Messaging', 'Mensajes') },
  { icon: Calendar, label: L('Appointments', 'Citas') },
  { icon: BarChart3, label: L('Analytics', 'Analítica') },
  { icon: Settings, label: L('Settings', 'Ajustes') },
]

function Frame({ className, children, label }: { className?: string; children: React.ReactNode; label: string }) {
  return (
    <figure aria-label={label} className={cn('overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-elevated', className)}>
      {children}
    </figure>
  )
}

function Sparkline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 36" className={cn('h-9 w-full', className)} aria-hidden="true" preserveAspectRatio="none">
      <path d="M0 28 L12 24 L22 26 L34 18 L46 21 L58 14 L70 17 L82 9 L94 12 L106 5 L120 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Avatar({ letter, tone }: { letter: string; tone: 'blue' | 'amber' | 'violet' | 'slate' | 'rose' }) {
  const tones = {
    blue: 'bg-secondary text-primary',
    amber: 'bg-chart-2/20 text-chart-5',
    violet: 'bg-chart-5/10 text-chart-5',
    slate: 'bg-muted text-muted-foreground',
    rose: 'bg-destructive/10 text-destructive',
  }
  return <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', tones[tone])}>{letter}</span>
}

export function BrowserMockup({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <Frame className={className} label={t(L('Example client website for a plumbing company', 'Sitio web de ejemplo para una empresa de plomería'), locale)}>
      <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-2">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-chart-4/70" />
        <span className="size-2 rounded-full bg-success/70" />
        <span className="ml-3 h-4 flex-1 rounded bg-background" />
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-extrabold leading-none text-foreground">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">R</span>
          <span>
            Riverside
            <span className="block text-[8px] font-semibold tracking-widest text-primary">PLUMBING</span>
          </span>
        </span>
        <span className="hidden gap-3 text-[9px] font-medium text-muted-foreground sm:flex">
          <span className="text-primary">{t(L('Home', 'Inicio'), locale)}</span>
          <span>{t(L('Services', 'Servicios'), locale)}</span>
          <span>{t(L('About', 'Nosotros'), locale)}</span>
          <span>{t(L('Reviews', 'Reseñas'), locale)}</span>
        </span>
        <span className="rounded bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">{t(L('Get a Quote', 'Cotizar'), locale)}</span>
      </div>
      <div className="relative aspect-[16/8]">
        <Image
          src="/images/showcase/plumbing-hero.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 480px, 90vw"
          className="object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-inverse/90 via-inverse/60 to-transparent" />
        <div className="absolute inset-y-0 left-0 flex max-w-[60%] flex-col justify-center gap-2 p-5 text-inverse-foreground">
          <p className="text-balance text-base font-bold leading-tight sm:text-xl">
            {t(L('Trusted Plumbing Experts in Your Area', 'Expertos en plomería de confianza en tu zona'), locale)}
          </p>
          <p className="hidden text-[10px] leading-snug text-inverse-foreground/80 sm:block">
            {t(L('Fast, reliable plumbing services for homes and businesses. 24/7 emergency service.', 'Servicio de plomería rápido y confiable. Emergencias 24/7.'), locale)}
          </p>
          <span className="flex gap-2">
            <span className="rounded bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">{t(L('Get a Free Quote', 'Cotización gratis'), locale)}</span>
            <span className="rounded border border-inverse-foreground/60 px-2 py-1 text-[9px] font-semibold">{t(L('Call Now', 'Llamar'), locale)}</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t px-4 py-2.5 text-[9px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="size-3 text-primary" aria-hidden="true" />{t(L('24/7 Service', 'Servicio 24/7'), locale)}</span>
        <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-primary" aria-hidden="true" />{t(L('Licensed & Insured', 'Con licencia'), locale)}</span>
        <span className="flex items-center gap-1"><Star className="size-3 text-primary" aria-hidden="true" />{t(L('5-Star Rated', '5 estrellas'), locale)}</span>
      </div>
    </Frame>
  )
}

export function CrmSummaryMockup({ locale, className }: { locale: Locale; className?: string }) {
  const leads = [
    { name: 'Sarah Johnson', note: L('New lead · 2m ago', 'Nuevo lead · hace 2m'), letter: 'S', tone: 'blue' as const },
    { name: 'Mike Thompson', note: L('Quote request · 15m ago', 'Cotización · hace 15m'), letter: 'M', tone: 'amber' as const },
    { name: 'Emily Carter', note: L('Phone call · 1h ago', 'Llamada · hace 1h'), letter: 'E', tone: 'violet' as const },
  ]
  return (
    <Frame className={className} label={t(L('WebXXL CRM dashboard preview', 'Vista previa del panel de WebXXL CRM'), locale)}>
      <div className="flex">
        <div className="hidden w-24 shrink-0 flex-col gap-0.5 border-r p-2 sm:flex">
          <p className="mb-2 px-1 text-[10px] font-extrabold">
            Web<span className="text-primary">XXL</span> CRM
          </p>
          {crmNav.map((item, i) => (
            <span key={item.label.en} className={cn('flex items-center gap-1.5 rounded px-1.5 py-1 text-[8px] font-medium', i === 0 ? 'bg-secondary text-primary' : 'text-muted-foreground')}>
              <item.icon className="size-2.5" aria-hidden="true" />
              {t(item.label, locale)}
            </span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-3">
          <div>
            <p className="text-xs font-bold">{t(L('Good morning!', '¡Buenos días!'), locale)}</p>
            <p className="text-[9px] text-muted-foreground">{t(L("Here's what's happening with your business.", 'Esto es lo que pasa en tu negocio.'), locale)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-2">
              <p className="text-sm font-bold">248</p>
              <p className="text-[8px] text-muted-foreground">{t(L('Total leads', 'Leads totales'), locale)}</p>
              <p className="mt-1 text-[9px] font-semibold text-success">+12%</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-sm font-bold">63</p>
              <p className="text-[8px] text-muted-foreground">{t(L('Appointments', 'Citas'), locale)}</p>
              <p className="mt-1 text-[9px] font-semibold text-success">+28%</p>
            </div>
          </div>
          <Sparkline className="text-primary" />
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-semibold">{t(L('Recent leads', 'Leads recientes'), locale)}</p>
            {leads.map((lead) => (
              <div key={lead.name} className="flex items-center gap-2">
                <Avatar letter={lead.letter} tone={lead.tone} />
                <span className="flex flex-col">
                  <span className="text-[9px] font-semibold">{lead.name}</span>
                  <span className="text-[8px] text-muted-foreground">{t(lead.note, locale)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

export function CrmContactsMockup({ locale, className }: { locale: Locale; className?: string }) {
  const rows = [
    { name: 'Sarah Johnson', source: 'Website', status: L('New lead', 'Nuevo'), tone: 'rose' as const, time: '2m', letter: 'S' },
    { name: 'Mike Thompson', source: 'Google Ads', status: L('Contacted', 'Contactado'), tone: 'amber' as const, time: '15m', letter: 'M' },
    { name: 'Emily Carter', source: L('Referral', 'Referido').en, status: L('Appointment', 'Cita'), tone: 'blue' as const, time: '1h', letter: 'E' },
    { name: 'David Wilson', source: 'Facebook', status: L('Customer', 'Cliente'), tone: 'slate' as const, time: '2h', letter: 'D' },
  ]
  const statusTone = {
    rose: 'bg-destructive/10 text-destructive',
    amber: 'bg-chart-2/20 text-chart-5',
    blue: 'bg-secondary text-primary',
    slate: 'bg-success/15 text-success',
  }
  return (
    <Frame className={className} label={t(L('WebXXL CRM contacts view', 'Vista de contactos de WebXXL CRM'), locale)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-extrabold">
          Web<span className="text-primary">XXL</span>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Bell className="size-3.5" aria-hidden="true" />
          <span className="size-5 rounded-full bg-muted" />
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-32 shrink-0 flex-col gap-0.5 border-r p-3 md:flex">
          {crmNav.map((item, i) => (
            <span key={item.label.en} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium', i === 1 ? 'bg-secondary text-primary' : 'text-muted-foreground')}>
              <item.icon className="size-3" aria-hidden="true" />
              {t(item.label, locale)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div>
            <p className="text-base font-bold">{t(L('Contacts', 'Contactos'), locale)}</p>
            <p className="text-[10px] text-muted-foreground">{t(L('Manage your leads and customers', 'Gestiona tus leads y clientes'), locale)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 flex-1 items-center gap-1.5 rounded-md border px-2 text-[10px] text-muted-foreground">
              <Search className="size-3" aria-hidden="true" />
              {t(L('Search contacts...', 'Buscar contactos...'), locale)}
            </span>
            <span className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-semibold text-primary-foreground">
              <Plus className="size-3" aria-hidden="true" />
              {t(L('Add contact', 'Añadir'), locale)}
            </span>
          </div>
          <table className="w-full text-left text-[10px]">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 font-medium">{t(L('Name', 'Nombre'), locale)}</th>
                <th className="hidden py-1.5 font-medium sm:table-cell">{t(L('Source', 'Fuente'), locale)}</th>
                <th className="py-1.5 font-medium">{t(L('Status', 'Estado'), locale)}</th>
                <th className="py-1.5 text-right font-medium">{t(L('Activity', 'Actividad'), locale)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <Avatar letter={row.letter} tone={row.tone} />
                      <span className="truncate font-semibold">{row.name}</span>
                    </span>
                  </td>
                  <td className="hidden py-2 text-muted-foreground sm:table-cell">{row.source}</td>
                  <td className="py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold', statusTone[row.tone])}>{t(row.status, locale)}</span>
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  )
}

export function CampaignMockup({ locale, className }: { locale: Locale; className?: string }) {
  const bars = [40, 55, 35, 60, 72, 50, 80, 66, 90, 74, 85, 95]
  const activity = [
    { icon: Globe, text: L('New lead from website', 'Nuevo lead desde el sitio'), time: L('2 minutes ago', 'hace 2 minutos') },
    { icon: MessageSquare, text: L('SMS sent to Sarah Johnson', 'SMS enviado a Sarah Johnson'), time: L('12 minutes ago', 'hace 12 minutos') },
    { icon: Calendar, text: L('Appointment booked', 'Cita reservada'), time: L('1 hour ago', 'hace 1 hora') },
  ]
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Frame label={t(L('Campaign performance chart', 'Gráfica de rendimiento de campañas'), locale)} className="p-4">
        <p className="text-xs font-semibold">{t(L('Campaign performance', 'Rendimiento de campañas'), locale)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-lg font-bold"><Send className="size-3.5 text-primary" aria-hidden="true" />1,429</p>
            <p className="text-[10px] text-muted-foreground">{t(L('Messages sent', 'Mensajes enviados'), locale)} <span className="font-semibold text-success">+32%</span></p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-lg font-bold"><TrendingUp className="size-3.5 text-primary" aria-hidden="true" />312</p>
            <p className="text-[10px] text-muted-foreground">{t(L('Link clicks', 'Clics'), locale)} <span className="font-semibold text-success">+18%</span></p>
          </div>
        </div>
        <div className="mt-4 flex h-16 items-end gap-1" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-sm bg-primary" style={{ height: `${h}%`, opacity: 0.45 + (i / bars.length) * 0.55 }} />
          ))}
        </div>
      </Frame>
      <Frame label={t(L('Recent CRM activity', 'Actividad reciente del CRM'), locale)} className="p-4">
        <p className="text-xs font-semibold">{t(L('Recent activity', 'Actividad reciente'), locale)}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {activity.map((a) => (
            <li key={a.text.en} className="flex items-start gap-2">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <a.icon className="size-3" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-medium">{t(a.text, locale)}</span>
                <span className="text-[10px] text-muted-foreground">{t(a.time, locale)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Frame>
    </div>
  )
}

export function AnalyticsMockup({ locale, className }: { locale: Locale; className?: string }) {
  const stats = [
    { value: '12.4k', label: L('Visitors', 'Visitantes'), delta: '+18%' },
    { value: '386', label: L('Leads', 'Leads'), delta: '+24%' },
    { value: '3.1%', label: L('Conversion', 'Conversión'), delta: '+0.6' },
  ]
  const sources = [
    { label: 'Google Search', pct: 46 },
    { label: 'Google Business', pct: 24 },
    { label: L('Direct', 'Directo').en, pct: 18 },
    { label: L('Social', 'Redes').en, pct: 12 },
  ]
  return (
    <Frame className={cn('p-5', className)} label={t(L('Analytics dashboard preview', 'Vista previa de analítica'), locale)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{t(L('Growth overview', 'Resumen de crecimiento'), locale)}</p>
        <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{t(L('Last 30 days', 'Últimos 30 días'), locale)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label.en} className="rounded-lg border p-2.5">
            <p className="text-base font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{t(s.label, locale)}</p>
            <p className="text-[10px] font-semibold text-success">{s.delta}</p>
          </div>
        ))}
      </div>
      <Sparkline className="mt-4 h-16 text-primary" />
      <p className="mt-4 text-[11px] font-semibold">{t(L('Lead sources', 'Fuentes de leads'), locale)}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {sources.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-[10px]">
            <span className="w-24 shrink-0 text-muted-foreground">{s.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${s.pct}%` }} />
            </span>
            <span className="w-8 text-right font-semibold">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function InfrastructureMockup({ locale, className }: { locale: Locale; className?: string }) {
  const rows = [
    { icon: Server, label: L('Hosting', 'Hosting'), value: L('Operational · 99.9% uptime', 'Operativo · 99.9%'), ok: true },
    { icon: Lock, label: 'SSL', value: L('Active · auto-renews', 'Activo · auto-renovación'), ok: true },
    { icon: Globe, label: 'riversideplumbing.com', value: L('Renews in 284 days', 'Renueva en 284 días'), ok: true },
    { icon: Mail, label: L('Business email', 'Correo profesional'), value: L('3 mailboxes', '3 buzones'), ok: true },
    { icon: ShieldCheck, label: L('Backups', 'Respaldos'), value: L('Last backup 2h ago', 'Último respaldo hace 2h'), ok: true },
  ]
  return (
    <Frame className={cn('p-5', className)} label={t(L('Hosting and domain status panel', 'Panel de estado de hosting y dominio'), locale)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{t(L('Site health', 'Salud del sitio'), locale)}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {t(L('All systems normal', 'Todo en orden'), locale)}
        </span>
      </div>
      <ul className="mt-4 flex flex-col divide-y">
        {rows.map((row) => {
          const label = typeof row.label === 'string' ? row.label : t(row.label, locale)
          return (
            <li key={label} className="flex items-center gap-3 py-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
                <row.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-[10px] text-muted-foreground">{t(row.value, locale)}</span>
              </span>
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            </li>
          )
        })}
      </ul>
    </Frame>
  )
}

export function WebsiteStackMockup({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <BrowserMockup locale={locale} className="w-full md:w-[88%]" />
      <CrmSummaryMockup locale={locale} className="relative -mt-16 ml-auto w-[70%] sm:w-[60%] md:absolute md:-bottom-10 md:right-0 md:mt-0 md:w-[46%]" />
    </div>
  )
}

export function ServiceVisualMockup({ visual, locale, className }: { visual: ServiceVisual; locale: Locale; className?: string }) {
  switch (visual) {
    case 'crm':
      return <CrmContactsMockup locale={locale} className={className} />
    case 'campaigns':
      return <CampaignMockup locale={locale} className={className} />
    case 'analytics':
      return <AnalyticsMockup locale={locale} className={className} />
    case 'infrastructure':
      return <InfrastructureMockup locale={locale} className={className} />
    default:
      return <BrowserMockup locale={locale} className={className} />
  }
}

export type IndustrySiteMockupProps = {
  brand: Localized
  headline: Localized
  subhead: Localized
  primaryCta: Localized
  secondaryCta: Localized
  badges: Localized<string[]>
  image?: string
  imageAlt?: Localized
}

/** Browser-framed example website concept for an industry. All copy comes from industry data. */
export function IndustrySiteMockup({ locale, className, demoLabel, ...site }: IndustrySiteMockupProps & { locale: Locale; className?: string; demoLabel: string }) {
  const brand = t(site.brand, locale)
  return (
    <Frame className={className} label={`${demoLabel}: ${brand}`}>
      <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-2">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-chart-4/70" />
        <span className="size-2 rounded-full bg-success/70" />
        <span className="ml-3 h-4 flex-1 rounded bg-background" />
        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">{demoLabel}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-extrabold leading-none text-foreground">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{brand.charAt(0)}</span>
          {brand}
        </span>
        <span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">{t(site.primaryCta, locale)}</span>
      </div>
      <div className="relative min-h-56 overflow-hidden bg-foreground md:min-h-64">
        {site.image && (
          <Image src={site.image} alt={site.imageAlt ? t(site.imageAlt, locale) : ''} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover opacity-60" priority />
        )}
        <div className="relative flex max-w-xs flex-col gap-2 p-5 text-background md:p-6">
          <p className="text-balance text-xl font-extrabold leading-tight md:text-2xl">{t(site.headline, locale)}</p>
          <p className="text-pretty text-xs leading-relaxed text-background/85">{t(site.subhead, locale)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">{t(site.primaryCta, locale)}</span>
            <span className="rounded-md border border-background/60 px-3 py-1.5 text-[11px] font-semibold text-background">{t(site.secondaryCta, locale)}</span>
          </div>
        </div>
      </div>
      <ul className="grid grid-cols-3 divide-x border-t text-center">
        {t(site.badges, locale).slice(0, 3).map((badge) => (
          <li key={badge} className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-semibold text-foreground md:text-[11px]">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-pretty">{badge}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}
