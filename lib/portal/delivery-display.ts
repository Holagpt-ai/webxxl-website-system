import type { EtaResult } from '@/lib/portal/eta'

export function formatDeliveryForecast(
  eta: Pick<EtaResult, 'forecastDate' | 'targetDate'>,
  locale: string,
  labels: { etaUnavailable: string; targetDateLabel: string },
): { forecast: string; target: string | null } {
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' })
  const forecast = eta.forecastDate ? fmt.format(eta.forecastDate) : labels.etaUnavailable
  const target = eta.targetDate ? fmt.format(eta.targetDate) : null
  return { forecast, target }
}
