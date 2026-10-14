/**
 * Non-secret release configuration probes for ops and acceptance tests.
 * Never log or expose secret values.
 */
import { isAuthEmailConfigured } from '@/lib/integrations/email'

export type ReleaseConfigStatus = {
  authEmailConfigured: boolean
  resendApiKeyPresent: boolean
  authFromEmailPresent: boolean
  databaseUrlPresent: boolean
}

export function getWebxxlReleaseConfigStatus(): ReleaseConfigStatus {
  return {
    authEmailConfigured: isAuthEmailConfigured(),
    resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    authFromEmailPresent: Boolean(process.env.AUTH_FROM_EMAIL ?? process.env.LEADS_FROM_EMAIL),
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
  }
}
