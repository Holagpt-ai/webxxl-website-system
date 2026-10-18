import { NextResponse } from 'next/server'
import { verifyAutomationWorkerRequest } from '@/lib/automation/worker-auth'
import { isWorkflowWorkerEnabled } from '@/config/workflow-backend'
import { runWorkflowWorkerBatch } from '@/lib/platform/workflow/worker-runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 })
}

export async function POST(request: Request) {
  if (!isWorkflowWorkerEnabled()) {
    return NextResponse.json({ ok: false, error: 'disabled' }, { status: 404 })
  }
  if (!verifyAutomationWorkerRequest(request.headers)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const result = await runWorkflowWorkerBatch({ limit: 10 })
  return NextResponse.json({ ok: true, ...result })
}
