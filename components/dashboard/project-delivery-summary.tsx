import { StatusBadge } from '@/components/dashboard/primitives'
import { enumLabel } from '@/lib/i18n/labels'
import type { EtaResult } from '@/lib/portal/eta'
import { formatDeliveryForecast } from '@/lib/portal/delivery-display'

export function ProjectDeliverySummary({
  projectName,
  projectStatus,
  eta,
  locale,
  copy,
}: {
  projectName: string
  projectStatus: string
  eta: EtaResult
  locale: string
  copy: {
    projectStatuses: Record<string, string>
    etaStates: Record<string, string>
    phase: string
    nextMilestone: string
    eta: string
    etaUnavailable: string
    targetDate: string
    progress: string
  }
}) {
  const delivery = formatDeliveryForecast(eta, locale, {
    etaUnavailable: copy.etaUnavailable,
    targetDateLabel: copy.targetDate,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-semibold">{projectName}</p>
        <StatusBadge label={enumLabel(copy.projectStatuses, projectStatus)} />
        <StatusBadge label={enumLabel(copy.etaStates, eta.state)} tone={eta.state === 'at_risk' ? 'warn' : 'default'} />
      </div>
      <p className="text-3xl font-bold">{eta.progressPercent}%</p>
      <p className="text-sm text-muted-foreground">
        {copy.phase}: {eta.currentMilestoneTitle ?? '—'}
      </p>
      <p className="text-sm text-muted-foreground">
        {copy.nextMilestone}: {eta.nextMilestoneTitle ?? '—'}
      </p>
      <p className="text-sm text-muted-foreground">
        {copy.eta}: {delivery.forecast}
      </p>
      {delivery.target && (
        <p className="text-xs text-muted-foreground">
          {copy.targetDate}: {delivery.target}
        </p>
      )}
    </div>
  )
}
