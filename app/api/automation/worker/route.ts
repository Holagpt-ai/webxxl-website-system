import { NextResponse } from 'next/server'
import { verifyAutomationWorkerRequest } from '@/lib/automation/worker-auth'
import { processAutomationDeliveryBatch } from '@/lib/automation/worker'
import { isEnabled } from '@/config/features'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ ok: false, error: 'method_not_allowed' }, { status: 405 })
}

export async function POST(request: Request) {
  if (!isEnabled('automationWorker')) {
    return NextResponse.json({ ok: false, error: 'disabled' }, { status: 404 })
  }
  if (!verifyAutomationWorkerRequest(request.headers)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const result = await processAutomationDeliveryBatch(25)
  return NextResponse.json({ ok: true, ...result })
}
