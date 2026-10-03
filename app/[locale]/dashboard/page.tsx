import { ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { getSchedulerStatus, getSchedulerLaunchUrl } from '@/lib/integrations/scheduler'
import { Container, Icon, LocaleLink } from '@/components/site/primitives'
import type { IconName } from '@/lib/icons'

type Props = { params: Promise<{ locale: string }> }

function ServiceCard({
  locale,
  icon,
  title,
  description,
  href,
  external,
  status,
  actionLabel,
}: {
  locale: 'en' | 'es'
  icon: IconName
  title: string
  description: string
  href: string
  external?: boolean
  status?: { live: boolean; label: string }
  actionLabel: string
}) {
  const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Icon name={icon} className="size-8 text-primary" aria-hidden="true" />
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              status.live ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {status.live ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
            {status.label}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto pt-2">
        {external ? (
          <a
            href={href}
            {...linkProps}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {actionLabel}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        ) : (
          <LocaleLink locale={locale} href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {actionLabel}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </LocaleLink>
        )}
      </div>
    </div>
  )
}

export default async function DashboardPage({ params }: Props) {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale).dashboard
  const session = await getSession()
  const schedulerStatus = await getSchedulerStatus()

  return (
    <Container className="flex flex-col gap-8 py-2">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {dict.welcome}
          {session ? `, ${session.email}` : ''}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{dict.overview}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight">{dict.servicesTitle}</h2>
          <p className="text-sm text-muted-foreground">{dict.servicesDescription}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ServiceCard
            locale={locale as 'en' | 'es'}
            icon="megaphone"
            title={dict.schedulerTitle}
            description={dict.schedulerDescription}
            href="/dashboard/scheduler"
            status={{
              live: schedulerStatus.ok,
              label: schedulerStatus.ok ? dict.schedulerLive : dict.schedulerDown,
            }}
            actionLabel={dict.viewDetails}
          />
          <ServiceCard
            locale={locale as 'en' | 'es'}
            icon="monitor"
            title="Websites"
            description="Your WebXXL-built websites, hosting and domains."
            href="/hosting"
            actionLabel={dict.viewDetails}
          />
        </div>
      </section>
    </Container>
  )
}
