import { ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { getSchedulerLaunchUrl, getSchedulerStatus } from '@/lib/integrations/scheduler'
import { Container, buttonStyles } from '@/components/site/primitives'

type Props = { params: Promise<{ locale: string }> }

const platforms = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const

export default async function SchedulerPage({ params }: Props) {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale).dashboard
  const status = await getSchedulerStatus()
  const launchUrl = getSchedulerLaunchUrl()

  const steps = [
    { title: dict.stepApprovals, body: dict.stepApprovalsBody },
    { title: dict.stepConnect, body: dict.stepConnectBody },
    { title: dict.stepSchedule, body: dict.stepScheduleBody },
  ]

  return (
    <Container className="flex flex-col gap-8 py-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{dict.schedulerTitle}</h1>
        <p className="max-w-2xl text-muted-foreground">{dict.schedulerDescription}</p>
      </div>

      {/* Live status */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight">{dict.statusTitle}</h2>
          <p className="text-sm text-muted-foreground">{dict.statusDescription}</p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dict.schedulerTitle}</dt>
            <dd className="flex items-center gap-2 text-sm font-semibold">
              {status.ok ? (
                <>
                  <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />
                  {dict.schedulerLive}
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-red-600" aria-hidden="true" />
                  {dict.schedulerDown}
                </>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dict.appUrl}</dt>
            <dd className="truncate text-sm font-semibold">{launchUrl.replace('https://', '')}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dict.responseTime}</dt>
            <dd className="text-sm font-semibold">
              {status.latencyMs} {dict.ms}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a href={launchUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles.primary}>
            {dict.openScheduler}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <span key={p} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Next steps */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight">{dict.nextStepsTitle}</h2>
          <p className="text-sm text-muted-foreground">{dict.nextStepsDescription}</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-2xl border bg-card p-6 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="font-bold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </Container>
  )
}
