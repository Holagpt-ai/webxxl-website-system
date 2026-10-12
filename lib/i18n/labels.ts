/** Look up a status code. Unknown codes stay readable without inventing a translation. */
export function enumLabel(labels: object, value: string): string {
  const map = labels as { [key: string]: string }
  return map[value] ?? value.replaceAll('_', ' ')
}

const ACTION_ERRORS = [
  'unauthorized',
  'not_found',
  'invalid',
  'empty',
  'not_configured',
  'too_large',
  'cross_project',
  'failed',
] as const

export function actionErrorLabel(
  code: string,
  errors: {
    unauthorized: string
    notFound: string
    invalid: string
    notConfigured: string
    tooLarge: string
    crossProject: string
    failed: string
  },
): string {
  if (code === 'unauthorized') return errors.unauthorized
  if (code === 'not_found') return errors.notFound
  if (code === 'invalid' || code === 'empty') return errors.invalid
  if (code === 'not_configured') return errors.notConfigured
  if (code === 'too_large') return errors.tooLarge
  if (code === 'cross_project') return errors.crossProject
  if ((ACTION_ERRORS as readonly string[]).includes(code)) return errors.failed
  return errors.failed
}

/** Re-label a stored "Prefix: user text" activity without translating the user text. */
export function localizeStoredActivity(summary: string, eventType: string, labels: { [key: string]: string }): string {
  const label = labels[eventType]
  if (!label) return summary
  const splitAt = summary.indexOf(': ')
  if (splitAt === -1) return label
  const detail = summary.slice(splitAt + 2)
  return detail ? `${label}: ${detail}` : label
}
