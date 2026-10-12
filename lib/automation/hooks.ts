import { emitAutomationEventBestEffort } from '@/lib/automation/dispatch'

export const automationHooks = {
  projectCreated(input: {
    projectId: string
    customerAccountId: string
    actorUserId?: string
    projectName: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'PROJECT_CREATED',
      dedupeKey: `project.created:${input.projectId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        audience: 'customer_members',
        templateKey: 'projectCreated',
        templateVars: { projectName: input.projectName },
        title: 'New project started',
        body: `Your WebXXL project "${input.projectName}" is now active.`,
        actionUrl: '/dashboard/project',
        projectId: input.projectId,
      },
    })
  },
  milestoneCompleted(input: {
    milestoneId: string
    projectId: string
    customerAccountId: string
    actorUserId?: string
    title: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'MILESTONE_COMPLETED',
      dedupeKey: `milestone.completed:${input.milestoneId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        audience: 'customer_members',
        templateKey: 'milestoneCompleted',
        templateVars: { title: input.title },
        title: 'Milestone completed',
        body: input.title,
        actionUrl: '/dashboard/project',
        projectId: input.projectId,
      },
    })
  },
  approvalRequested(input: {
    approvalId: string
    customerAccountId: string
    actorUserId?: string
    title: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'APPROVAL_REQUESTED',
      dedupeKey: `approval.requested:${input.approvalId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        audience: 'customer_members',
        templateKey: 'approvalRequested',
        templateVars: { title: input.title },
        title: 'Approval requested',
        body: input.title,
        actionUrl: '/dashboard/approvals',
      },
    })
  },
  customerApprovalSubmitted(input: {
    approvalId: string
    customerAccountId: string
    actorUserId: string
    title: string
    decision: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'CUSTOMER_APPROVAL_SUBMITTED',
      dedupeKey: `approval.customer:${input.approvalId}:${input.decision}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        templateKey: 'customerApprovalSubmitted',
        templateVars: { title: input.title, decision: input.decision },
        title: 'Customer approval response',
        body: `${input.title} — ${input.decision}`,
        actionUrl: '/admin/approvals',
      },
    })
  },
  customerMessageReceived(input: {
    projectId: string
    customerAccountId: string
    actorUserId: string
    preview: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'CUSTOMER_MESSAGE_RECEIVED',
      dedupeKey: `message.customer:${input.projectId}:${Date.now().toString(36)}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        templateKey: 'customerMessageReceived',
        templateVars: { preview: input.preview },
        title: 'New customer message',
        body: input.preview,
        actionUrl: `/admin/projects/${input.projectId}`,
      },
    })
  },
  changeRequestSubmitted(input: {
    changeRequestId: string
    customerAccountId: string
    actorUserId: string
    title: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'CHANGE_REQUEST_SUBMITTED',
      dedupeKey: `change_request.submitted:${input.changeRequestId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        templateKey: 'changeRequestSubmitted',
        templateVars: { title: input.title },
        title: 'Change request submitted',
        body: input.title,
        actionUrl: '/admin/requests',
      },
    })
  },
  leadReceived(input: { leadId: string; headline?: string | null }) {
    return emitAutomationEventBestEffort({
      eventType: 'LEAD_RECEIVED',
      dedupeKey: `lead.received:${input.leadId}`,
      payload: {
        templateKey: input.headline ? 'leadReceived' : 'leadCaptured',
        templateVars: input.headline ? { headline: input.headline } : {},
        title: 'New sales lead',
        body: input.headline ?? 'A new lead was captured.',
        actionUrl: `/admin/leads/${input.leadId}`,
      },
    })
  },
  leadAssigned(input: { leadId: string; assignedToId: string | null }) {
    return emitAutomationEventBestEffort({
      eventType: 'LEAD_ASSIGNED',
      dedupeKey: `lead.assigned:${input.leadId}:${input.assignedToId ?? 'none'}`,
      payload: {
        templateKey: input.assignedToId ? 'leadAssigned' : 'leadUnassigned',
        templateVars: {},
        title: 'Lead assignment updated',
        body: input.assignedToId ? 'A lead was assigned to you.' : 'A lead was unassigned.',
        actionUrl: `/admin/leads/${input.leadId}`,
        recipients: input.assignedToId ? [{ userId: input.assignedToId }] : [],
      },
    })
  },
  leadFollowUpDue(input: { leadId: string; assigneeUserId?: string | null }) {
    return emitAutomationEventBestEffort({
      eventType: 'LEAD_FOLLOW_UP_DUE',
      dedupeKey: `lead.follow_up_due:${input.leadId}:${new Date().toISOString().slice(0, 10)}`,
      payload: {
        templateKey: 'leadFollowUpDue',
        templateVars: {},
        title: 'Lead follow-up due',
        body: 'A scheduled lead follow-up is due today.',
        actionUrl: `/admin/leads/${input.leadId}`,
        recipients: input.assigneeUserId ? [{ userId: input.assigneeUserId }] : [],
      },
    })
  },
  leadConverted(input: { leadId: string; customerAccountId: string }) {
    return emitAutomationEventBestEffort({
      eventType: 'LEAD_CONVERTED',
      dedupeKey: `lead.converted:${input.leadId}`,
      customerAccountId: input.customerAccountId,
      payload: {
        templateKey: 'leadConverted',
        templateVars: {},
        title: 'Lead converted to customer',
        body: 'A sales lead was converted to a customer account.',
        actionUrl: `/admin/customers/${input.customerAccountId}`,
      },
    })
  },
  serviceOrderRequested(input: {
    orderId: string
    publicId: string
    customerAccountId: string
    actorUserId: string
    serviceKey: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'SERVICE_ORDER_REQUESTED',
      dedupeKey: `service_order.requested:${input.orderId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        audience: 'customer_members',
        templateKey: 'serviceOrderRequested',
        templateVars: { publicId: input.publicId, serviceKey: input.serviceKey },
        title: 'Service request submitted',
        body: `${input.publicId} — ${input.serviceKey}`,
        actionUrl: '/dashboard/services',
      },
    })
  },
  serviceOrderQuoteReady(input: {
    orderId: string
    publicId: string
    customerAccountId: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'SERVICE_ORDER_QUOTE_READY',
      dedupeKey: `service_order.quote:${input.orderId}`,
      customerAccountId: input.customerAccountId,
      payload: {
        audience: 'customer_members',
        templateKey: 'serviceOrderQuoteReady',
        templateVars: { publicId: input.publicId },
        title: 'Service quote ready',
        body: `Your quote for ${input.publicId} is ready for review.`,
        actionUrl: '/dashboard/services',
      },
    })
  },
  serviceOrderStatusUpdated(input: {
    orderId: string
    publicId: string
    customerAccountId: string
    status: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'SERVICE_ORDER_STATUS_UPDATED',
      dedupeKey: `service_order.status:${input.orderId}:${input.status}`,
      customerAccountId: input.customerAccountId,
      payload: {
        audience: 'customer_members',
        templateKey: 'serviceOrderStatusUpdated',
        templateVars: { publicId: input.publicId, status: input.status },
        title: 'Service order update',
        body: `${input.publicId} is now ${input.status}.`,
        actionUrl: '/dashboard/services',
      },
    })
  },
  serviceActivated(input: {
    orderId: string
    customerAccountId: string
    serviceKey: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'SERVICE_ACTIVATED',
      dedupeKey: `service_order.activated:${input.orderId}`,
      customerAccountId: input.customerAccountId,
      payload: {
        audience: 'customer_members',
        templateKey: 'serviceActivated',
        templateVars: { serviceKey: input.serviceKey },
        title: 'Service activated',
        body: `${input.serviceKey} is now active on your account.`,
        actionUrl: '/dashboard/services',
      },
    })
  },
  infrastructureSupportRequestSubmitted(input: {
    supportRequestId: string
    customerAccountId: string
    actorUserId: string
    subject: string
  }) {
    return emitAutomationEventBestEffort({
      eventType: 'INFRASTRUCTURE_SUPPORT_REQUEST_SUBMITTED',
      dedupeKey: `infrastructure.support:${input.supportRequestId}`,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      payload: {
        templateKey: 'infrastructureSupportRequest',
        templateVars: { subject: input.subject },
        title: 'Infrastructure service request',
        body: input.subject,
        actionUrl: '/admin/infrastructure',
      },
    })
  },
}
