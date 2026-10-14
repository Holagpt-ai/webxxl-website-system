import { CustomerOnboardingForm } from '@/components/admin/onboarding-form'
import { PageTitle } from '@/components/dashboard/primitives'
import { requireAdmin } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }

export default async function AdminOnboardingPage({ params }: Props) {
  await requireAdmin()
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  const copy = dict.admin.onboarding

  return (
    <>
      <PageTitle title={copy.title} description={copy.description} />
      <CustomerOnboardingForm />
    </>
  )
}
