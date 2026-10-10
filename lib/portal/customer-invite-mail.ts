import { signIn } from '@/auth'
import { isAuthEmailConfigured } from '@/lib/integrations/email'
import { buildCustomerActivationRedirect, type CustomerAccessLocale } from '@/lib/portal/customer-access'

export async function sendCustomerInvitationMagicLink(
  email: string,
  customerAccountId: string,
  locale: CustomerAccessLocale,
): Promise<{ ok: true } | { ok: false; error: 'email_not_configured' | 'email_failed' }> {
  if (!isAuthEmailConfigured()) return { ok: false, error: 'email_not_configured' }
  const redirectTo = buildCustomerActivationRedirect(customerAccountId, locale)
  try {
    await signIn('email', {
      email,
      redirect: false,
      redirectTo,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'email_failed' }
  }
}
