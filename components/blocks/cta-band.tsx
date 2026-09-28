import { ctas } from '@/config/ctas'
import type { Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/localize'
import { ButtonLink, Container } from '@/components/site/primitives'

const defaults = {
  en: {
    eyebrow: 'Ready to grow?',
    title: "Let's build a website that works as hard as you do.",
    description:
      'Book a free strategy call and we will show you how WebXXL can help you get more leads, more customers and more growth — with a website and CRM built for your industry.',
    note: 'No pressure. Just a conversation about your goals.',
  },
  es: {
    eyebrow: '¿Listo para crecer?',
    title: 'Construyamos un sitio web que trabaje tanto como tú.',
    description:
      'Agenda una llamada estratégica gratuita y te mostraremos cómo WebXXL puede ayudarte a conseguir más leads, más clientes y más crecimiento — con un sitio web y CRM hechos para tu industria.',
    note: 'Sin presión. Solo una conversación sobre tus metas.',
  },
}

export function CtaBand({ locale, title, description }: { locale: Locale; title?: string; description?: string }) {
  const copy = defaults[locale] ?? defaults.en
  return (
    <section aria-labelledby="cta-band-title" className="bg-primary text-primary-foreground">
      <Container className="flex flex-col gap-8 py-14 md:py-16 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">{copy.eyebrow}</p>
          <h2 id="cta-band-title" className="text-balance text-3xl font-extrabold leading-tight md:text-4xl">
            {title ?? copy.title}
          </h2>
          <p className="text-pretty leading-relaxed text-primary-foreground/85">{description ?? copy.description}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-center">
          <ButtonLink locale={locale} href={ctas.bookCall.href} variant="inverse" icon="calendar" arrow className="h-14 px-8 text-base">
            {t(ctas.bookCall.label, locale)}
          </ButtonLink>
          <p className="text-sm text-primary-foreground/80">{copy.note}</p>
        </div>
      </Container>
    </section>
  )
}
