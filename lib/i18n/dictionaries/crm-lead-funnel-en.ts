import type { CohortKey, DateRangeProblem, EventKey, FunnelIssue, StatusSegment } from '@/lib/crm-ui/lead-funnel'

type StateCopy = { title: string; body: string }

export type CrmLeadFunnelCopy = {
  title: string
  description: string
  backToInbox: string
  generatedAt: string
  refresh: string
  refreshing: string
  loading: string
  retry: string
  notTotal: string
  filters: {
    label: string
    from: string
    to: string
    site: string
    allSites: string
    form: string
    formPlaceholder: string
    formHint: string
    apply: string
    clear: string
    utcNote: string
    defaultRange: string
    activeRange: string
    rangeProblems: Record<DateRangeProblem, string>
  }
  cohort: {
    title: string
    description: string
    metrics: Record<CohortKey, string>
    hints: Record<CohortKey, string>
    convertedShare: string
  }
  events: {
    title: string
    description: string
    metrics: Record<EventKey, string>
    hints: Record<EventKey, string>
  }
  trend: {
    title: string
    description: string
    series: string
    ariaLabel: string
    tableToggle: string
    date: string
    peak: string
  }
  status: {
    title: string
    description: string
    ariaLabel: string
    segments: Record<StatusSegment, string>
    share: string
    incomplete: string
  }
  breakdown: {
    siteTitle: string
    siteDescription: string
    formTitle: string
    formDescription: string
    siteColumn: string
    formColumn: string
    columns: Record<CohortKey, string>
    sortBy: string
    unknownSite: string
    siteFiltered: string
    formFiltered: string
    empty: string
    formEmpty: string
    limited: string
    formNullNote: string
  }
  attribution: {
    title: string
    description: string
    linkedTitle: string
    linked: string
    noneLinked: string
    stateVerifiedPartial: string
    stateNone: string
    fieldsTitle: string
    fields: Record<string, string>
    disclaimer: string
  }
  empty: { title: string; body: string; filteredTitle: string; filteredBody: string }
  issues: Record<FunnelIssue, StateCopy>
}

export const crmLeadFunnelEn: CrmLeadFunnelCopy = {
  title: 'Lead funnel',
  description:
    'How inquiries from your managed websites move from first contact to review, qualification, and CRM contact. Every number comes from stored lead records.',
  backToInbox: 'Back to lead inbox',
  generatedAt: 'Report generated {time}',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  loading: 'Loading lead funnel report',
  retry: 'Try again',
  notTotal: 'Not a full count',
  filters: {
    label: 'Report filters',
    from: 'Created from',
    to: 'Created to',
    site: 'Website',
    allSites: 'All websites',
    form: 'Form reference',
    formPlaceholder: 'Any form',
    formHint: 'Exact form reference. Press Apply to update.',
    apply: 'Apply',
    clear: 'Clear filters',
    utcNote: 'Days are calendar days in UTC.',
    defaultRange: 'Showing the last 30 days',
    activeRange: '{from} – {to}',
    rangeProblems: {
      order: 'The start date must be on or before the end date.',
      tooLong: 'The date range can cover at most 366 days.',
      invalid: 'Enter valid dates.',
    },
  },
  cohort: {
    title: 'Leads created in this period',
    description:
      'Leads created within the selected dates, grouped by their status today. A lead created in this period and converted later still counts as converted here.',
    metrics: {
      leadsReceived: 'Leads received',
      awaitingReview: 'Awaiting review',
      qualified: 'Qualified',
      converted: 'Converted to CRM contact',
      rejected: 'Rejected',
      duplicateReview: 'Duplicate review',
    },
    hints: {
      leadsReceived: 'Created in the selected dates',
      awaitingReview: 'Received, pending, or duplicate review',
      qualified: 'Ready to convert',
      converted: 'A CRM contact, not a completed sale',
      rejected: 'Closed without a contact',
      duplicateReview: 'May match an existing contact',
    },
    convertedShare: '{pct} of this period’s leads',
  },
  events: {
    title: 'Activity during this period',
    description:
      'Actions your team took within the selected dates, by their stored timestamps. These can include leads created earlier, so they are not added to the counts above.',
    metrics: {
      conversionsInPeriod: 'Contacts created',
      qualifiedEventsInPeriod: 'Leads qualified',
      rejectedEventsInPeriod: 'Leads rejected',
    },
    hints: {
      conversionsInPeriod: 'Leads converted to CRM contacts. Not sales.',
      qualifiedEventsInPeriod: 'Qualification dates in range',
      rejectedEventsInPeriod: 'Rejection dates in range',
    },
  },
  trend: {
    title: 'Leads received per day',
    description: 'New leads created each day in the selected period.',
    series: 'Leads received',
    ariaLabel: 'Area chart of leads received per day from {start} to {end}',
    tableToggle: 'Show daily values as a table',
    date: 'Date',
    peak: 'Busiest day: {date} ({count})',
  },
  status: {
    title: 'Where these leads are now',
    description: 'Current status of every lead created in the selected period.',
    ariaLabel: 'Status distribution of leads created in this period',
    segments: {
      pending: 'Received or pending review',
      duplicateReview: 'Duplicate review',
      qualified: 'Qualified',
      converted: 'Converted to CRM contact',
      rejected: 'Rejected',
    },
    share: '{pct}',
    incomplete: 'Status distribution is unavailable because some counts are not complete account totals.',
  },
  breakdown: {
    siteTitle: 'By website',
    siteDescription: 'Leads created in this period for each managed website.',
    formTitle: 'By form',
    formDescription: 'Leads created in this period for each form reference.',
    siteColumn: 'Website',
    formColumn: 'Form reference',
    columns: {
      leadsReceived: 'Received',
      awaitingReview: 'Awaiting',
      qualified: 'Qualified',
      converted: 'Converted',
      rejected: 'Rejected',
      duplicateReview: 'Duplicates',
    },
    sortBy: 'Sort by {column}',
    unknownSite: 'Not in your website list',
    siteFiltered: 'This report is filtered to one website, so the per-website breakdown is hidden. Clear the website filter to compare sites.',
    formFiltered: 'This report is filtered to one form, so the per-form breakdown is hidden. Clear the form filter to compare forms.',
    empty: 'No websites received leads in this period.',
    formEmpty: 'No leads in this period carry a form reference.',
    limited: 'Showing the top {count} groups by leads received.',
    formNullNote: 'Leads without a form reference are not listed here, so rows may add up to less than the total.',
  },
  attribution: {
    title: 'Source coverage',
    description: 'What the stored lead records can tell you about where these leads came from.',
    linkedTitle: 'Linked to an analytics event',
    linked: '{count} of {total} leads carry an analytics event reference.',
    noneLinked: 'No leads in this period are linked to an analytics event.',
    stateVerifiedPartial: 'Partial source data recorded',
    stateNone: 'No analytics linkage recorded',
    fieldsTitle: 'Fields recorded on each lead',
    fields: {
      'siteLeads.attribution.managedSiteId': 'Website the form was on',
      'siteLeads.attribution.formReference': 'Form reference',
      'siteLeads.attribution.submittedAt': 'Time the visitor submitted',
      'siteLeads.attribution.createdAt': 'Time the lead was stored',
      'siteLeads.attribution.sourceAttribution': 'Source details sent with the form',
      'siteLeads.attribution.analyticsEventRef': 'Analytics event reference',
    },
    disclaimer:
      'This is not GA4, Google Ads, or Meta Ads attribution. No campaign revenue, advertising return, or lead score is calculated.',
  },
  empty: {
    title: 'No website leads in this period',
    body: 'When visitors send a form on one of your managed websites, the lead appears here. Try a wider date range to look further back.',
    filteredTitle: 'No leads match these filters',
    filteredBody: 'Nothing was recorded for this combination of dates, website, and form. Adjust or clear the filters.',
  },
  issues: {
    crmDisabled: {
      title: 'CRM is turned off',
      body: 'Lead reporting is part of the CRM, which is not active for this account yet.',
    },
    ineligible: {
      title: 'Not included in your plan',
      body: 'Lead funnel reporting is available to subscribers with the CRM module.',
    },
    notConfigured: {
      title: 'Lead reporting is not set up yet',
      body: 'The lead records this report reads are not available on this environment yet. No numbers are shown until they are.',
    },
    policyUnresolved: {
      title: 'Access is being confirmed',
      body: 'We could not confirm your subscription right now. Try again in a moment.',
    },
    unauthorized: {
      title: 'Sign in again',
      body: 'Your session has ended. Sign in to see this report.',
    },
    forbidden: {
      title: 'You don’t have access',
      body: 'Your role in this account cannot view CRM reports. Ask an account owner for access.',
    },
    siteForbidden: {
      title: 'Website not available',
      body: 'The selected website does not belong to this account. Choose another website or clear the filter.',
    },
    invalidDates: {
      title: 'Check the dates',
      body: 'The report could not use this date range.',
    },
    rateLimited: {
      title: 'Too many requests',
      body: 'Wait a moment, then refresh the report.',
    },
    unavailable: {
      title: 'Report unavailable',
      body: 'The reporting service did not respond. Your data is safe; try again shortly.',
    },
  },
}
