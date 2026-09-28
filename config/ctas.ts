import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'
import { clientPortalHref } from '@/lib/integrations/portal'

export type Cta = {
  label: Localized
  href: string
  icon?: IconName
}

/** Every major call to action lives here so wording and destinations stay consistent. */
export const ctas = {
  bookCall: {
    label: { en: 'Book a Strategy Call', es: 'Agenda una llamada' },
    href: '/get-started?intent=strategy-call',
    icon: 'calendar',
  },
  getStarted: {
    label: { en: 'Get Started', es: 'Comenzar' },
    href: '/get-started',
  },
  startWebsite: {
    label: { en: 'Start Your Website', es: 'Crea tu sitio web' },
    href: '/get-started?project=new-website',
  },
  seeHowItWorks: {
    label: { en: 'See How It Works', es: 'Mira cómo funciona' },
    href: '/#how-it-works',
  },
  seeCrm: {
    label: { en: 'See the CRM in Action', es: 'Ver el CRM en acción' },
    href: '/crm',
  },
  viewCaseStudies: {
    label: { en: 'View Case Studies', es: 'Ver casos de estudio' },
    href: '/case-studies',
  },
  viewPricing: {
    label: { en: 'View Pricing', es: 'Ver precios' },
    href: '/pricing',
  },
  contact: {
    label: { en: 'Contact WebXXL', es: 'Contactar a WebXXL' },
    href: '/contact',
  },
  clientLogin: {
    label: { en: 'Client Login', es: 'Acceso clientes' },
    href: clientPortalHref,
  },
} satisfies Record<string, Cta>

export type CtaId = keyof typeof ctas
