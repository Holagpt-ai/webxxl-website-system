/**
 * Frontend feature switches. Disabling a flag hides navigation entries and
 * makes the related routes return 404 (or a disabled-feature state).
 */
export const features = {
  announcementBar: true,
  blog: true,
  crmMarketing: true,
  pricing: true,
  caseStudies: true,
  strategyCall: true,
  support: true,
  clientLogin: true,
  newsletter: true,
  domainSearch: false,
  annualBilling: false,
  aiServices: false,
  serviceMarketplace: true,
  infrastructureManagement: true,
  automationNotifications: true,
  automationEmailChannel: true,
  automationWorker: true,
  automationRenewalReminders: true,
  automationSmsChannel: false,
  automationWhatsappChannel: false,
  automationPushChannel: false,
  purchasableAiEmployees: false,
  /** Customer analytics & BI HTTP APIs (BATCH-14). Default off. */
  analyticsBackend: false,
} as const

export type FeatureFlag = keyof typeof features

export function isEnabled(flag: FeatureFlag): boolean {
  return features[flag]
}
