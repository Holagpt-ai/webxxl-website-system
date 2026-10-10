import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectAdminDetail } from '@/lib/admin/queries'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff } from '@/lib/portal/authz'
import { resolveLocale } from '@/lib/i18n/server'
import { calculateProjectEta } from '@/lib/portal/eta'
import {
  ApprovalForm,
  AttachApprovalFilesForm,
  DeleteFileButton,
  DependencyForm,
  MilestoneForm,
  MilestoneStatusButton,
  ProjectStatusForm,
  StaffCommentForm,
  StaffFileUploadForm,
  TaskForm,
  TaskStatusSelect,
} from '@/components/admin/forms'
import { LinkedFileList, ProjectFileList } from '@/components/files/project-file-list'
import { filterCustomerComments } from '@/lib/portal/access-rules'
import { isStorageConfigured } from '@/lib/integrations/storage'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; projectId: string }> }

export default async function AdminProjectDetailPage({ params }: Props) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const { projectId } = await params
  const data = await getProjectAdminDetail(projectId)
  if (!data) notFound()
  const { project, milestones, tasks, dependencies, approvals, activities, files, comments } = data
  const storageReady = isStorageConfigured()
  const customerMessages = filterCustomerComments(comments)
  const internalNotes = comments.filter((comment) => comment.visibility === 'INTERNAL')
  const prefix = locale === 'es' ? '/es' : ''

  const eta = calculateProjectEta({
    projectStatus: project.status,
    targetDate: project.targetDate,
    estimatedCompletionDate: project.estimatedCompletionDate,
    milestones: milestones.map((m) => ({
      title: m.title,
      status: m.status,
      progressWeight: m.progressWeight,
      targetDate: m.targetDate,
      completedAt: m.completedAt,
    })),
    customerOpenDependencies: dependencies
      .filter((d) => d.status === 'REQUESTED' || d.status === 'IN_PROGRESS')
      .map((d) => ({ status: d.status, dueDate: d.dueDate })),
  })

  return (
    <>
      <PageTitle
        title={project.name}
        description={`${project.customerAccount.businessName} · ETA ${eta.stateLabel} (${eta.progressPercent}%)`}
      />
      <p className="-mt-6 mb-6 text-sm">
        <Link href={`${prefix}/admin/customers/${project.customerAccount.id}`} className="text-primary hover:underline">
          View customer
        </Link>
      </p>

      <SectionCard title="Project settings">
        <ProjectStatusForm projectId={project.id} status={project.status} progressPercent={project.progressPercent} />
      </SectionCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Milestones">
          <MilestoneForm projectId={project.id} />
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border-b pb-2">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <StatusBadge label={m.status} />
                </div>
                <MilestoneStatusButton projectId={project.id} milestoneId={m.id} title={m.title} status={m.status} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Tasks">
          <TaskForm projectId={project.id} />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.title}</span>
                <TaskStatusSelect projectId={project.id} taskId={t.id} title={t.title} status={t.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Customer dependencies">
          <DependencyForm projectId={project.id} />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {dependencies.map((d) => (
              <li key={d.id}>
                {d.title} · <StatusBadge label={d.status} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Approvals">
          <ApprovalForm projectId={project.id} />
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {approvals.map((a) => (
              <li key={a.id} className="border-b pb-3">
                <p>
                  {a.title} · <StatusBadge label={a.status} />
                </p>
                <LinkedFileList
                  files={a.fileLinks.map((link) => link.projectFile)}
                  storageReady={storageReady}
                  downloadLabel="Download"
                />
                <AttachApprovalFilesForm projectId={project.id} approvalId={a.id} files={files} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Project files">
          {!storageReady && <p className="mb-3 text-sm text-muted-foreground">File storage is not configured.</p>}
          <StaffFileUploadForm projectId={project.id} storageReady={storageReady} />
          <div className="mt-4">
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files on this project.</p>
            ) : (
              <ProjectFileList
                files={files}
                locale={locale}
                storageReady={storageReady}
                downloadLabel="Download"
                categoryLabel={(category) => category}
                trailing={(file) => <DeleteFileButton projectId={project.id} fileId={file.id} />}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Messages">
          <StaffCommentForm projectId={project.id} />
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer thread</h3>
          {customerMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer messages.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {customerMessages.map((comment) => (
                <li key={comment.id} className="rounded-lg border p-2">
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{comment.author.name ?? comment.author.email}</p>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</h3>
          {internalNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No internal notes.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {internalNotes.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-dashed p-2">
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{comment.author.name ?? comment.author.email}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
      <SectionCard title="Activity">
        <ul className="flex flex-col gap-2 text-sm">
          {activities.map((a) => (
            <li key={a.id}>
              {a.summary}
              {a.actor?.email ? ` · ${a.actor.email}` : ''}
            </li>
          ))}
        </ul>
      </SectionCard>
      </div>
    </>
  )
}
