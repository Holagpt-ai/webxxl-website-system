import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmTasks } from '@/components/crm/tasks'

export const dynamic = 'force-dynamic'

export default async function CrmTasksPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmTasks {...await getCrmPageProps(params)} />
}
