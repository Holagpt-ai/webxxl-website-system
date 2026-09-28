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
} as const

export type FeatureFlag = keyof typeof features

export function isEnabled(flag: FeatureFlag): boolean {
  return features[flag]
}
