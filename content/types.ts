import type { IconName } from '@/lib/icons'
import type { Localized } from '@/lib/i18n/localize'

/** Shorthand for an English + Spanish pair. */
export function l(en: string, es: string): Localized {
  return { en, es }
}

export type ContentItem = { title: Localized; description: Localized }
export type FeatureItem = ContentItem & { icon: IconName }
export type FaqItem = { question: Localized; answer: Localized }
export type Seo = { title?: Localized; description?: Localized }
