import { workspaceKitEn } from './crm-workspace-en'

export const businessCenterEn = {
  kit: workspaceKitEn,
  name: 'Business Command Center',
  title: 'Business Command Center',
  description:
    'One view of what needs attention across your CRM, marketing, local SEO, communications and website projects. This page is read-only: every item opens the workspace where you take action.',
  distinction: 'Your website preview, project timeline and project approvals stay on the main dashboard.',
  dashboardLink: 'Go to project dashboard',
  generatedAt: 'Overview prepared {time}',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  loading: 'Loading business overview',
  staleAccount: 'The active account changed. Refresh to load the overview for the current account.',

  modulesTitle: 'Business modules',
  modulesDescription: 'Account totals from each workspace. Modules report independently, so one unavailable service never hides the others.',
  modules: {
    crm: { name: 'CRM', open: 'Open CRM' },
    marketing: { name: 'Marketing Studio', open: 'Open Marketing Studio' },
    local_seo: { name: 'Local SEO', open: 'Open Local SEO' },
    communications: { name: 'Communications', open: 'Open Communications' },
    website_projects: { name: 'Website Projects', open: 'Open project' },
  },
  metrics: {
    openTasks: 'Open tasks',
    openDeals: 'Open deals',
    pendingMerges: 'Duplicate reviews',
    draftRequests: 'Draft requests',
    pendingReviews: 'Awaiting review',
    preparedArtifacts: 'Prepared deliverables',
    actionableOpportunities: 'Actionable opportunities',
    inboxes: 'Inboxes',
    needsAttentionConversations: 'Need attention',
    pendingApprovals: 'Pending approvals',
    openDependencies: 'Open items from you',
  } as Record<string, string>,
  readiness: {
    available: { label: 'Ready', body: '' },
    disabled: {
      label: 'Turned off',
      body: 'This module is switched off in this environment, so no activity is shown. This does not mean there is nothing to do.',
    },
    not_configured: {
      label: 'Not set up',
      body: 'This module has not been configured for your account yet, so its activity cannot be shown.',
    },
    policy_unresolved: {
      label: 'Access pending',
      body: 'Access to this module is still being confirmed for your account. Nothing needs to be done on your side.',
    },
    not_eligible: {
      label: 'Not included',
      body: 'Your current plan does not include this module. Contact us if you would like to add it.',
    },
    unauthorized: {
      label: 'No access',
      body: 'Your role on this account does not have permission to view this module. Ask an account owner for access.',
    },
    unavailable: {
      label: 'Unavailable',
      body: 'This module’s data cannot be retrieved right now. Other modules are unaffected. Try refreshing later.',
    },
  },
  checkedAt: 'Checked {time}',
  emptyModule: 'Nothing needs attention here right now.',
  referenceCode: 'Reference: {code}',
  inList: '{count} in priority list',
  showInList: 'Show {module} items in the priority list',

  actions: {
    title: 'Priority actions',
    description:
      'Items that need a decision or follow-up, in the order your workspaces rank them. Opening an item takes you to its workspace; nothing is changed from here.',
    filterLabel: 'Filter by module',
    all: 'All',
    highOnly: 'High priority only',
    empty: 'No action items right now. New tasks, reviews and conversations will appear here.',
    emptyFiltered: 'No items match this filter.',
    limitNote: 'Shows up to {max} items and at most {perModule} per module. Module totals above may be higher.',
    shown: '{count} items shown',
    due: 'Due {date}',
    updated: 'Updated {time}',
    open: 'Open',
    linkUnavailable: 'Link unavailable',
    notReporting: 'Not reporting: {modules}. See module status above.',
  },
  priority: {
    high: 'High',
    medium: 'Medium',
    normal: 'Normal',
    low: 'Low',
  },
  actionTypes: {
    'crm.task.overdue': 'Overdue task',
    'crm.task.open': 'Open task',
    'crm.deal.open': 'Open deal',
    'crm.merge.pending': 'Duplicate contacts to review',
    'marketing.request.draft': 'Draft marketing request',
    'marketing.review.pending': 'Marketing review pending',
    'marketing.artifact.prepared': 'Deliverable ready to review',
    'marketing.artifact.review': 'Deliverable in review',
    'local_seo.opportunity.actionable': 'SEO opportunity',
    'communications.conversation.needs_attention': 'Conversation needs attention',
    'communications.inbox.setup': 'Inbox needs setup',
    'website_projects.approval.pending': 'Project approval pending',
    'website_projects.dependency.open': 'Project item needed from you',
  } as Record<string, string>,
  unknownAction: 'Action item',
}

export type BusinessCenterCopy = typeof businessCenterEn
