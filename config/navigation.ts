import { isEnabled, type FeatureFlag } from './features'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type NavKey = keyof Dictionary['nav']

export type NavLink = { key: NavKey; href: string; flag?: FeatureFlag }
export type NavItem =
  | ({ type: 'link' } & NavLink)
  | { type: 'menu'; key: NavKey; menu: 'solutions' | 'industries'; href: string }

/** Header navigation. Reorder, add or remove entries here. Menu panels are built from the registries. */
export const primaryNav: NavItem[] = [
  { type: 'menu', key: 'solutions', menu: 'solutions', href: '/solutions' },
  { type: 'menu', key: 'industries', menu: 'industries', href: '/industries' },
  { type: 'link', key: 'crm', href: '/crm', flag: 'crmMarketing' },
  { type: 'link', key: 'hosting', href: '/hosting' },
  { type: 'link', key: 'domains', href: '/domains' },
  { type: 'link', key: 'caseStudies', href: '/case-studies', flag: 'caseStudies' },
  { type: 'link', key: 'blog', href: '/blog', flag: 'blog' },
  { type: 'link', key: 'pricing', href: '/pricing', flag: 'pricing' },
]

export const companyLinks: NavLink[] = [
  { key: 'about', href: '/about' },
  { key: 'caseStudies', href: '/case-studies', flag: 'caseStudies' },
  { key: 'pricing', href: '/pricing', flag: 'pricing' },
  { key: 'blog', href: '/blog', flag: 'blog' },
  { key: 'contact', href: '/contact' },
  { key: 'getStarted', href: '/get-started' },
]

export type ResourceLink = { label: { en: string; es?: string }; href: string; flag?: FeatureFlag }

export const resourceLinks: ResourceLink[] = [
  { label: { en: 'Help Center', es: 'Centro de ayuda' }, href: '/support', flag: 'support' },
  { label: { en: 'Guides', es: 'Guías' }, href: '/blog', flag: 'blog' },
  { label: { en: 'Privacy Policy', es: 'Privacidad' }, href: '/privacy' },
  { label: { en: 'Terms of Service', es: 'Términos' }, href: '/terms' },
  { label: { en: 'Accessibility', es: 'Accesibilidad' }, href: '/accessibility' },
]

export function visible<T extends { flag?: FeatureFlag }>(items: T[]): T[] {
  return items.filter((i) => !i.flag || isEnabled(i.flag))
}
