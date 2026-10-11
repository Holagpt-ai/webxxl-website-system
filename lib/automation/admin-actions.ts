'use server'

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/portal/authz'
import { retryAutomationDeliveryJob } from '@/lib/automation/worker'

export type AutomationAdminActionResult = { ok: true } | { ok: false; error: string }

function revalidateAdminAutomation() {
  revalidatePath('/admin/automation')
  revalidatePath('/es/admin/automation')
}

export async function adminRetryDeliveryJobAction(jobId: string): Promise<AutomationAdminActionResult> {
  try {
    await requireStaff()
    const result = await retryAutomationDeliveryJob(jobId)
    if (!result.ok) return result
    revalidateAdminAutomation()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function adminRetryDeliveryJobFormAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get('jobId') ?? '')
  if (!jobId) return
  await adminRetryDeliveryJobAction(jobId)
}
