import type { LeadIssue, LeadStatus, LeadSummaryKey } from '@/lib/crm-ui/leads'

type StateCopy = { title: string; body: string }

export type CrmLeadsCopy = {
  navLabel: string
  title: string
  description: string
  summary: {
    title: string
    description: string
    metrics: Record<LeadSummaryKey, string>
    hints: Record<LeadSummaryKey, string>
    notTotal: string
    siteScoped: string
  }
  filters: {
    label: string
    status: string
    allStatuses: string
    site: string
    allSites: string
    from: string
    to: string
    clear: string
  }
  list: {
    title: string
    loading: string
    emptyAll: StateCopy
    emptyFiltered: StateCopy
    noName: string
    previous: string
    next: string
    page: string
    selectHint: string
    openLead: string
  }
  detail: {
    title: string
    placeholder: StateCopy
    loading: string
    close: string
    contact: string
    fields: {
      name: string
      email: string
      phone: string
      site: string
      form: string
      submitted: string
      received: string
      locale: string
      status: string
      message: string
      noMessage: string
      crmContact: string
      convertedAt: string
      duplicateOf: string
    }
    openContact: string
    duplicateNotice: StateCopy
    consentNotice: string
    terminal: Record<'REJECTED' | 'CONVERTED', string>
  }
  actions: {
    title: string
    pendingReview: string
    qualify: string
    reject: string
    convert: string
    working: string
    noneAvailable: string
    readOnly: string
    rejectDialog: {
      title: string
      body: string
      reason: string
      reasonHint: string
      confirm: string
    }
    convertDialog: {
      title: string
      body: string
      points: string[]
      confirm: string
      retry: string
      retryNote: string
    }
  }
  results: {
    pendingReview: string
    qualify: string
    reject: string
    convert: string
    contactId: string
  }
  issues: Record<LeadIssue, StateCopy>
  statuses: Record<LeadStatus, string>
}

export const crmLeadsEn: CrmLeadsCopy = {
  navLabel: 'Leads',
  title: 'Lead inbox',
  description:
    'Inquiries sent through the forms on your managed websites. Review each one, then qualify, reject, or convert it into a CRM contact yourself.',
  summary: {
    title: 'Lead summary',
    description: 'Counts for this account, taken directly from the lead service.',
    metrics: {
      leadsReceived: 'Leads received',
      awaitingReview: 'Awaiting review',
      qualified: 'Qualified',
      converted: 'Converted',
      rejected: 'Rejected',
      duplicateReview: 'Duplicate review',
    },
    hints: {
      leadsReceived: 'All leads in this account',
      awaitingReview: 'Received, pending review, or duplicate review',
      qualified: 'Ready to convert',
      converted: 'Now CRM contacts',
      rejected: 'Closed without a contact',
      duplicateReview: 'May match an existing contact',
    },
    notTotal: 'Not a full count',
    siteScoped: 'Counts for the selected site',
  },
  filters: {
    label: 'Filter leads',
    status: 'Status',
    allStatuses: 'All statuses',
    site: 'Website',
    allSites: 'All websites',
    from: 'Received from',
    to: 'Received to',
    clear: 'Clear filters',
  },
  list: {
    title: 'Inbox',
    loading: 'Loading leads',
    emptyAll: {
      title: 'No leads yet',
      body: 'When someone sends a form on one of your managed websites, the inquiry appears here.',
    },
    emptyFiltered: {
      title: 'No leads match these filters',
      body: 'Change or clear the filters to see more leads.',
    },
    noName: 'No name given',
    previous: 'Previous',
    next: 'Next',
    page: 'Page {page}',
    selectHint: 'Select a lead to review it.',
    openLead: 'Review lead from {name}',
  },
  detail: {
    title: 'Lead review',
    placeholder: {
      title: 'No lead selected',
      body: 'Choose a lead from the inbox to see its details and the actions available for it.',
    },
    loading: 'Loading lead',
    close: 'Close lead',
    contact: 'Contact details',
    fields: {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      site: 'Website',
      form: 'Form',
      submitted: 'Submitted',
      received: 'Received',
      locale: 'Language',
      status: 'Status',
      message: 'Message',
      noMessage: 'No message was included.',
      crmContact: 'CRM contact',
      convertedAt: 'Converted',
      duplicateOf: 'Possible duplicate of lead',
    },
    openContact: 'Open CRM contact',
    duplicateNotice: {
      title: 'Possible duplicate',
      body: 'This lead may match an existing lead or CRM contact. It will not be merged automatically. Check your contacts, then qualify it again or reject it.',
    },
    consentNotice:
      'Sending a website form is not marketing consent. Converting a lead creates a contact without any marketing permission.',
    terminal: {
      REJECTED: 'This lead was rejected. No further actions are available.',
      CONVERTED: 'This lead is now a CRM contact. No further actions are available.',
    },
  },
  actions: {
    title: 'Qualification',
    pendingReview: 'Mark for review',
    qualify: 'Qualify',
    reject: 'Reject',
    convert: 'Convert to contact',
    working: 'Working…',
    noneAvailable: 'No actions are available for this status.',
    readOnly: 'Your role can view leads but not change them.',
    rejectDialog: {
      title: 'Reject this lead?',
      body: 'The lead is closed and cannot be converted afterwards. No message is sent to the person.',
      reason: 'Reason',
      reasonHint: 'Optional, up to 500 characters. Only visible to your team.',
      confirm: 'Reject lead',
    },
    convertDialog: {
      title: 'Convert this lead into a CRM contact?',
      body: 'A new contact is created in your CRM from this lead.',
      points: [
        'The contact is created with the name, email, and phone from the lead.',
        'No marketing consent is recorded. You cannot send marketing to this contact until they agree separately.',
        'If a contact with the same email or phone already exists, nothing is merged. The lead moves to duplicate review instead.',
        'No email, SMS, or WhatsApp message is sent.',
      ],
      confirm: 'Convert lead',
      retry: 'Try conversion again',
      retryNote: 'Retrying reuses the same request, so a contact cannot be created twice.',
    },
  },
  results: {
    pendingReview: 'The lead is marked for review.',
    qualify: 'The lead is qualified.',
    reject: 'The lead was rejected.',
    convert: 'The lead was converted into a CRM contact.',
    contactId: 'Contact ID',
  },
  issues: {
    intakeDisabled: {
      title: 'Lead inbox is turned off',
      body: 'Website lead intake is switched off in this environment, so no leads can be shown. This does not mean you have no leads.',
    },
    crmDisabled: {
      title: 'CRM is turned off',
      body: 'The CRM service is switched off in this environment, so leads cannot be loaded or changed.',
    },
    ineligible: {
      title: 'Not included in your plan',
      body: 'Your current subscription does not include the CRM, so the lead inbox is not available for this account.',
    },
    policyUnresolved: {
      title: 'Eligibility could not be confirmed',
      body: 'We could not confirm that your subscription includes the CRM right now. This is not a problem with your account. Try again later.',
    },
    unauthorized: {
      title: 'Sign in again',
      body: 'Your session has ended. Sign in again to continue.',
    },
    forbidden: {
      title: 'You do not have permission',
      body: 'Your role in this account cannot do this. Ask an account owner.',
    },
    notFound: {
      title: 'Lead not found',
      body: 'This lead does not exist in this account, or it was removed.',
    },
    rateLimited: {
      title: 'Too many requests',
      body: 'Wait a moment, then try again.',
    },
    unavailable: {
      title: 'Service unavailable',
      body: 'The lead service did not respond. Nothing was changed. Try again in a moment.',
    },
    statusConflict: {
      title: 'The lead changed',
      body: 'Someone else updated this lead, so this action no longer applies. The latest status is shown now.',
    },
    identityConflict: {
      title: 'A matching contact already exists',
      body: 'A CRM contact with the same email or phone already exists. No contact was created and nothing was merged. The lead is now in duplicate review.',
    },
    conversionPending: {
      title: 'Conversion still in progress',
      body: 'This conversion has not finished yet. No contact is confirmed. Try again in a moment.',
    },
    conflict: {
      title: 'This could not be completed',
      body: 'The request conflicts with the current state of this lead. Nothing was changed.',
    },
    validation: {
      title: 'Check the details',
      body: 'Some details are missing or invalid.',
    },
    error: {
      title: 'Something went wrong',
      body: 'We could not complete this. Try again in a moment.',
    },
  },
  statuses: {
    RECEIVED: 'Received',
    PENDING_REVIEW: 'Pending review',
    QUALIFIED: 'Qualified',
    REJECTED: 'Rejected',
    CONVERTED: 'Converted',
    DUPLICATE_REVIEW: 'Duplicate review',
  },
}
