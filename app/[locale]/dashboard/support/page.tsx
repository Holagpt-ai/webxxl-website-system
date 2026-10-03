import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { ButtonLink, Container, Icon } from '@/components/site/primitives'
import { ctas } from '@/config/ctas'

type Props = { params: Promise<{ locale: string }> }

export default async function SupportPage({ params }: Props) {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale).dashboard
  return (
    <Container className="flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{dict.supportTitle}</h1>
        <p className="max-w-2xl text-muted-foreground">{dict.supportDescription}</p>
      </div>
      <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-8 shadow-sm">
        <Icon name="lifebuoy" className="size-10 text-primary" aria-hidden="true" />
        <ButtonLink locale={locale as 'en' | 'es'} href={ctas.contact.href}>{dict.contactSupport}</ButtonLink>
      </div>
    </Container>
  )
}
