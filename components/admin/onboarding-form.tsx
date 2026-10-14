'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAdminCopy } from '@/components/admin/locale'
import { createCustomerOnboardingAction } from '@/lib/admin/actions'
import { listProjectTemplates } from '@/lib/project-templates/registry'
import { actionErrorLabel } from '@/lib/i18n/labels'

const templates = listProjectTemplates()

export function CustomerOnboardingForm() {
  const router = useRouter()
  const { admin: copy, locale } = useAdminCopy()
  const onboarding = copy.onboarding
  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryContactName, setPrimaryContactName] = useState('')
  const [primaryContactEmail, setPrimaryContactEmail] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('OWNER')
  const [projectName, setProjectName] = useState('')
  const [projectSummary, setProjectSummary] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [targetDate, setTargetDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        setMessage(null)
        startTransition(async () => {
          const result = await createCustomerOnboardingAction({
            businessName,
            slug: slug.trim() || undefined,
            primaryContactName: primaryContactName.trim() || undefined,
            primaryContactEmail: primaryContactEmail.trim() || undefined,
            locale,
            inviteEmail: inviteEmail.trim() || primaryContactEmail.trim() || undefined,
            inviteRole: inviteRole as 'OWNER' | 'MEMBER',
            inviteLocale: locale,
            projectName: projectName.trim() || undefined,
            projectSummary: projectSummary.trim() || undefined,
            templateId: projectName.trim() ? templateId : undefined,
            targetDate: targetDate.trim() || undefined,
          })
          if (!result.ok) {
            setError(actionErrorLabel(result.error, copy.errors))
            return
          }
          if (result.inviteRequested && !result.inviteSent) {
            setMessage(onboarding.invitePending)
          } else if (result.projectId) {
            setMessage(onboarding.successWithProject)
          } else {
            setMessage(onboarding.successAccountOnly)
          }
          const prefix = locale === 'es' ? '/es' : ''
          router.push(`${prefix}/admin/customers/${result.customerAccountId}`)
        })
      }}
    >
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{onboarding.accountSection}</h2>
        <div>
          <Label htmlFor="ob-business">{onboarding.businessName}</Label>
          <Input id="ob-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="ob-slug">{onboarding.slug}</Label>
          <Input id="ob-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={onboarding.slugHint} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ob-contact-name">{copy.customers.contact}</Label>
            <Input id="ob-contact-name" value={primaryContactName} onChange={(e) => setPrimaryContactName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ob-contact-email">{copy.email}</Label>
            <Input id="ob-contact-email" type="email" value={primaryContactEmail} onChange={(e) => setPrimaryContactEmail(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{onboarding.accessSection}</h2>
        <p className="text-sm text-muted-foreground">{onboarding.accessHelp}</p>
        <div>
          <Label htmlFor="ob-invite-email">{onboarding.inviteEmail}</Label>
          <Input id="ob-invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={onboarding.inviteEmailHint} />
        </div>
        <div>
          <Label htmlFor="ob-invite-role">{copy.role}</Label>
          <select
            id="ob-invite-role"
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          >
            <option value="OWNER">{copy.owner}</option>
            <option value="MEMBER">{copy.member}</option>
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{onboarding.projectSection}</h2>
        <p className="text-sm text-muted-foreground">{onboarding.projectHelp}</p>
        <div>
          <Label htmlFor="ob-project-name">{onboarding.projectName}</Label>
          <Input id="ob-project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={onboarding.projectNameHint} />
        </div>
        <div>
          <Label htmlFor="ob-template">{onboarding.template}</Label>
          <select
            id="ob-template"
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={!projectName.trim()}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ob-target">{onboarding.targetDate}</Label>
          <Input id="ob-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={!projectName.trim()} />
        </div>
        <div>
          <Label htmlFor="ob-summary">{onboarding.projectSummary}</Label>
          <Textarea id="ob-summary" value={projectSummary} onChange={(e) => setProjectSummary(e.target.value)} rows={3} disabled={!projectName.trim()} />
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {onboarding.submit}
      </Button>
    </form>
  )
}
