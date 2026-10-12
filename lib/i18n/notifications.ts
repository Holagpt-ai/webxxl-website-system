import type { Locale } from './config'
import { getDictionary } from './dictionaries'
import { format } from './localize'
import { enumLabel } from './labels'

export type NotificationTemplateKey = keyof ReturnType<typeof getDictionary>['systemNotifications']

const TEMPLATE_KEYS = new Set<string>([
  'projectCreated',
  'milestoneCompleted',
  'milestoneUpdate',
  'approvalRequested',
  'customerApprovalSubmitted',
  'customerMessageReceived',
  'changeRequestSubmitted',
  'changeRequestUpdate',
  'leadReceived',
  'leadCaptured',
  'leadAssigned',
  'leadUnassigned',
  'leadFollowUpDue',
  'leadConverted',
  'serviceOrderRequested',
  'serviceOrderQuoteReady',
  'serviceOrderStatusUpdated',
  'serviceActivated',
  'infrastructureSupportRequest',
  'filesOnChangeRequest',
  'filesOnSupportRequest',
  'customerUploadedFile',
  'fileAddedToProject',
  'reviewFilesAdded',
  'newProjectMessage',
  'dependencyRequested',
  'domainRenewal',
  'hostingRenewal',
  'emailRenewal',
])

export function isNotificationTemplateKey(value: unknown): value is NotificationTemplateKey {
  return typeof value === 'string' && TEMPLATE_KEYS.has(value)
}

export function templateVars(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number') out[key] = String(item)
  }
  return out
}

/**
 * Renders a system notification in the recipient's language.
 * Values such as names, message text, and file names are inserted as written.
 */
export function renderSystemNotification(
  locale: Locale,
  key: NotificationTemplateKey,
  vars: Record<string, string>,
): { title: string; body: string } {
  const dict = getDictionary(locale)
  const copy = dict.systemNotifications[key]
  const next = { ...vars }
  if (next.status) {
    next.status = enumLabel(
      { ...dict.dashboard.marketplaceOrderStatusLabels, ...dict.dashboard.changeRequestStatuses },
      next.status,
    )
  }
  if (next.decision) {
    next.decision = enumLabel(dict.dashboard.approvalStatuses, next.decision)
  }
  return { title: format(copy.title, next), body: format(copy.body, next) }
}
