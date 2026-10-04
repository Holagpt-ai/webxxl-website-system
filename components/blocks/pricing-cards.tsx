import { Info } from 'lucide-react'
import { pricingSettings, type PricingPlan } from '@/config/pricing'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format, t } from '@/lib/i18n/localize'
import { getPlanActionHref } from '@/lib/integrations/billing'
import { cn } from '@/lib/utils'
import { ButtonLink, CheckList } from '@/components/site/primitives'

function money(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function PlanPrice({ plan, locale }: { plan: PricingPlan; locale: Locale }) {
  const dict = getDictionary(locale)
  if (plan.displayPrice && (pricingSettings.showPublicAmounts || plan.priceModel === 'contact')) return <p className="text-3xl font-extrabold">{t(plan.displayPrice, locale)}</p>
  if (plan.priceModel === 'contact') return <p className="text-3xl font-extrabold">{dict.pricing.contactForPrice}</p>
  if (!pricingSettings.showPublicAmounts) return <p className="text-2xl font-extrabold tracking-tight">{dict.pricing.beingFinalized}</p>
  if (plan.priceMonthly == null) return <p className="text-3xl font-extrabold">{dict.pricing.contactForPrice}</p>
  if (plan.priceModel === 'free') return <p className="text-4xl font-extrabold">{dict.pricing.free}</p>
  return (
    <div className="flex flex-col gap-1">
      {plan.priceModel === 'startingAt' && <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dict.pricing.startingAt}</span>}
      <p className="flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight md:text-5xl">{money(plan.priceMonthly, plan.currency, locale)}</span>
        <span className="text-muted-foreground">{dict.pricing.perMonth}</span>
      </p>
      {plan.setupFee ? <span className="text-sm text-muted-foreground">{format(dict.pricing.setupFee, { amount: money(plan.setupFee, plan.currency, locale) })}</span> : null}
    </div>
  )
}

export function PricingCards({ plans, locale }: { plans: PricingPlan[]; locale: Locale }) {
  const dict = getDictionary(locale)
  return (
    <div className="flex flex-col gap-6">
      <ul className={cn('grid gap-6', plans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {plans.map((plan) => (
          <li
            key={plan.id}
            className={cn(
              'relative flex flex-col gap-6 rounded-2xl border bg-card p-7',
              plan.highlighted ? 'border-2 border-primary shadow-elevated md:-my-3 md:py-10' : 'shadow-card',
            )}
          >
            {plan.highlighted && (
              <span className="absolute inset-x-0 top-0 rounded-t-xl bg-primary py-1 text-center text-xs font-bold uppercase tracking-widest text-primary-foreground">
                {plan.badge ? t(plan.badge, locale) : dict.pricing.mostPopular}
              </span>
            )}
            <div className={cn('flex flex-col gap-1', plan.highlighted && 'pt-3')}>
              <h3 className="text-xl font-bold">{t(plan.name, locale)}</h3>
              <p className="text-sm text-muted-foreground">{t(plan.description, locale)}</p>
            </div>
            <PlanPrice plan={plan} locale={locale} />
            {plan.promotion && <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">{t(plan.promotion, locale)}</p>}
            <CheckList items={t(plan.features, locale)} className="text-sm" />
            <ButtonLink
              locale={locale}
              href={getPlanActionHref(plan)}
              variant={plan.highlighted ? 'primary' : 'outline'}
              className="mt-auto w-full"
            >
              {t(plan.ctaLabel, locale)}
            </ButtonLink>
          </li>
        ))}
      </ul>
      {pricingSettings.showPreliminaryNotice && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {dict.pricing.notice}
        </p>
      )}
    </div>
  )
}
