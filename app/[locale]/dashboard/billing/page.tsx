import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { Container, Icon } from '@/components/site/primitives'

type Props = { params: Promise<{ locale: string }> }

export default async function BillingPage({ params }: Props) {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale).dashboard
  return (
    <Container className="flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{dict.billingTitle}</h1>
        <p className="max-w-2xl text-muted-foreground">{dict.billingDescription}</p>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center shadow-sm">
        <Icon name="card" className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{dict.billingSoon}</p>
      </div>
    </Container>
  )
}
