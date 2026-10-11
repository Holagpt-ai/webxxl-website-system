import type { AutomationEventType, NotificationType } from '@prisma/client'

export type PreferenceCategory =
  | 'projectUpdates'
  | 'messagesAndApprovals'
  | 'serviceOrders'
  | 'infrastructureRenewals'
  | 'transactionalEmail'
  | 'essential'

export type EventDefinition = {
  preferenceCategory: PreferenceCategory
  notificationType: NotificationType
  essential?: boolean
}

export const AUTOMATION_EVENT_REGISTRY: Record<AutomationEventType, EventDefinition> = {
  PROJECT_CREATED: { preferenceCategory: 'projectUpdates', notificationType: 'MILESTONE_UPDATE' },
  MILESTONE_COMPLETED: { preferenceCategory: 'projectUpdates', notificationType: 'MILESTONE_UPDATE' },
  APPROVAL_REQUESTED: { preferenceCategory: 'messagesAndApprovals', notificationType: 'APPROVAL_REQUESTED' },
  CUSTOMER_APPROVAL_SUBMITTED: { preferenceCategory: 'messagesAndApprovals', notificationType: 'APPROVAL_REQUESTED' },
  CUSTOMER_MESSAGE_RECEIVED: { preferenceCategory: 'messagesAndApprovals', notificationType: 'PROJECT_MESSAGE' },
  CHANGE_REQUEST_SUBMITTED: { preferenceCategory: 'projectUpdates', notificationType: 'CHANGE_REQUEST_UPDATE' },
  LEAD_RECEIVED: { preferenceCategory: 'essential', notificationType: 'GENERAL', essential: true },
  LEAD_ASSIGNED: { preferenceCategory: 'essential', notificationType: 'GENERAL', essential: true },
  LEAD_FOLLOW_UP_DUE: { preferenceCategory: 'essential', notificationType: 'GENERAL', essential: true },
  LEAD_CONVERTED: { preferenceCategory: 'essential', notificationType: 'GENERAL', essential: true },
  SERVICE_ORDER_REQUESTED: { preferenceCategory: 'serviceOrders', notificationType: 'GENERAL' },
  SERVICE_ORDER_QUOTE_READY: { preferenceCategory: 'serviceOrders', notificationType: 'GENERAL' },
  SERVICE_ORDER_STATUS_UPDATED: { preferenceCategory: 'serviceOrders', notificationType: 'GENERAL' },
  SERVICE_ACTIVATED: { preferenceCategory: 'serviceOrders', notificationType: 'GENERAL' },
  DOMAIN_RENEWAL_APPROACHING: { preferenceCategory: 'infrastructureRenewals', notificationType: 'GENERAL' },
  HOSTING_RENEWAL_APPROACHING: { preferenceCategory: 'infrastructureRenewals', notificationType: 'GENERAL' },
  EMAIL_SERVICE_RENEWAL_APPROACHING: { preferenceCategory: 'infrastructureRenewals', notificationType: 'GENERAL' },
  INFRASTRUCTURE_SUPPORT_REQUEST_SUBMITTED: {
    preferenceCategory: 'essential',
    notificationType: 'GENERAL',
    essential: true,
  },
}
