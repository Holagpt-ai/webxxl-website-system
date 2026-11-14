import Link from 'next/link'
import { listSupportQueue } from '@/lib/admin/queries'
import { LinkedFileList } from '@/components/files/project-file-list'
import { isStorageConfigured } from '@/lib/integrations/storage'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { enumLabel } from '@/lib/i18n/labels'
import { resolveLocale } from '@/lib/i18n/server'
import { SupportStatusForm } from '@/components/admin/forms'
import { StaffSupportReplyForm } from '@/components/admin/staff-support-reply-form'
import { RecordQueryFocus } from '@/components/dashboard/record-query-focus'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const copy = getDictionary(locale).admin
  const tickets = await listSupportQueue()
  const prefix = locale === 'es' ? '/es' : ''
  const storageReady = isStorageConfigured()

  return (
    <>
      <RecordQueryFocus param="ticketId" domIdPrefix="admin-support-ticket-" ready />
      <PageTitle title={copy.support.title} description={copy.support.description} />
      {tickets.length === 0 ? (
        <EmptyState title={copy.support.emptyTitle} body={copy.support.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-4">
          {tickets.map((sr) => (
            <li key={sr.id} id={`admin-support-ticket-${sr.id}`} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                <div>
                  <p className="font-semibold">{sr.subject}</p>
                  <p className="text-muted-foreground">
                    {sr.customerAccount.businessName}
                    {sr.project ? ` · ${sr.project.name}` : ''}
                  </p>
                  <StatusBadge label={enumLabel(getDictionary(locale).dashboard.supportStatuses, sr.status)} />
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{sr.message}</p>
                  {sr.messages.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
                      {sr.messages.map((msg) => (
                        <li key={msg.id} className="rounded-md bg-muted/60 px-3 py-2 text-xs">
                          <p>{msg.body}</p>
                          <p className="mt-1 text-muted-foreground">
                            {msg.author.name ?? msg.author.email} · {new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en').format(msg.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <LinkedFileList
                    files={sr.fileLinks.map((link) => link.projectFile)}
                    storageReady={storageReady}
                    downloadLabel={copy.download}
                  />
                  {sr.projectId && (
                    <Link href={`${prefix}/admin/projects/${sr.projectId}`} className="mt-2 inline-block text-primary hover:underline">
                      {copy.project}
                    </Link>
                  )}
                  <Link href={`${prefix}/admin/customers/${sr.customerAccountId}`} className="ml-3 text-primary hover:underline">
                    {copy.customer}
                  </Link>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <SupportStatusForm supportRequestId={sr.id} current={sr.status} />
                  {sr.status !== 'CLOSED' && (
                    <StaffSupportReplyForm
                      supportRequestId={sr.id}
                      labels={{
                        staffReplyLabel: copy.support.staffReplyLabel,
                        staffReplyPlaceholder: copy.support.staffReplyPlaceholder,
                        staffReplySubmit: copy.support.staffReplySubmit,
                        staffReplySuccess: copy.support.staffReplySuccess,
                        staffReplyErrors: copy.support.staffReplyErrors,
                        save: copy.save,
                      }}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
