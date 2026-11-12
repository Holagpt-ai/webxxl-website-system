import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { rejectClientAuthority } from '@/lib/platform/ai-workforce-execution/constants'
import {
  bindHumanApprovedAction,
  pauseAccountWorkforce,
  prepareAccountWorkforceAction,
  resumeAccountWorkforce,
} from '@/lib/platform/ai-workforce-execution/orchestration'
import { getAiWorkforceOrchestrationStore } from '@/lib/platform/ai-workforce-execution/store'
import { getAiWorkforceExecutionSummary } from '@/lib/platform/ai-workforce-execution/summary'

export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
}

export async function assertAccountSite(
  customerAccountId: string,
  managedSiteId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!managedSiteId) return { ok: true }
  const site = await prisma.managedSite.findFirst({
    where: { id: managedSiteId, customerAccountId },
    select: { id: true },
  })
  if (!site) return { ok: false, message: 'Managed site not found for account' }
  return { ok: true }
}

export async function GET(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read AI workforce execution for a different customer account' },
        { status: 403 },
      )
    }
    const managedSiteId = url.searchParams.get('managedSiteId')
    const site = await assertAccountSite(portal.customerAccount.id, managedSiteId)
    if (!site.ok) return NextResponse.json({ code: 'NOT_FOUND', message: site.message }, { status: 404 })
    const summary = getAiWorkforceExecutionSummary({
      customerAccountId: portal.customerAccount.id,
      managedSiteId,
      store: getAiWorkforceOrchestrationStore(),
    })
    return NextResponse.json({ summary })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    console.error('ai workforce execution summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load AI workforce execution summary' }, { status: 500 })
  }
}

export async function prepareFromRequest(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const body = (await request.json()) as Record<string, unknown>
    const forged = rejectClientAuthority(body)
    if (forged) {
      return NextResponse.json(
        { code: 'CLIENT_AUTHORITY_REJECTED', message: `Client cannot set ${forged}` },
        { status: 400 },
      )
    }
    const requestedAccountId = typeof body.customerAccountId === 'string' ? body.customerAccountId : null
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot prepare AI workforce work for a different customer account' },
        { status: 403 },
      )
    }
    const managedSiteId = typeof body.managedSiteId === 'string' ? body.managedSiteId : null
    const site = await assertAccountSite(portal.customerAccount.id, managedSiteId)
    if (!site.ok) return NextResponse.json({ code: 'NOT_FOUND', message: site.message }, { status: 404 })
    const sourceRecordIds = Array.isArray(body.sourceRecordIds)
      ? body.sourceRecordIds.filter((item): item is string => typeof item === 'string')
      : []
    const result = prepareAccountWorkforceAction(getAiWorkforceOrchestrationStore(), {
      customerAccountId: portal.customerAccount.id,
      actorUserId: portal.id,
      toolKey: typeof body.toolKey === 'string' ? body.toolKey : '',
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
      locale: typeof body.locale === 'string' ? body.locale : 'en',
      managedSiteId,
      sourceRecordIds,
      untrustedPrompt: typeof body.untrustedPrompt === 'string' ? body.untrustedPrompt : undefined,
      liveExecutionRequested: body.liveExecutionRequested === true,
      targetAccountId: typeof body.targetAccountId === 'string' ? body.targetAccountId : undefined,
      channelConnected: typeof body.channelConnected === 'boolean' ? body.channelConnected : null,
    })
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' || result.code === 'TENANT_MISMATCH' ? 403 : 409
      return NextResponse.json({ code: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ preparation: result.value })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    console.error('ai workforce preparation POST failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to prepare AI workforce action' }, { status: 500 })
  }
}

export async function bindFromRequest(request: Request, preparationId: string) {
  try {
    const portal = await requireCustomerMembership()
    const body = (await request.json()) as Record<string, unknown>
    if ('approverUserId' in body || 'customerAccountId' in body || 'executionEnabled' in body) {
      return NextResponse.json(
        { code: 'CLIENT_AUTHORITY_REJECTED', message: 'Client cannot set approver, account, or execution' },
        { status: 400 },
      )
    }
    const decision = body.decision === 'REJECTED' ? 'REJECTED' : body.decision === 'APPROVED' ? 'APPROVED' : null
    if (!decision) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Decision must be APPROVED or REJECTED' }, { status: 400 })
    }
    const result = bindHumanApprovedAction(getAiWorkforceOrchestrationStore(), {
      customerAccountId: portal.customerAccount.id,
      preparationId,
      approverUserId: portal.id,
      approvalId: typeof body.approvalId === 'string' ? body.approvalId : '',
      actionHash: typeof body.actionHash === 'string' ? body.actionHash : '',
      decision,
    })
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409
      return NextResponse.json({ code: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ preparation: result.value })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    console.error('ai workforce approval POST failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to bind workforce approval' }, { status: 500 })
  }
}

export async function pauseFromRequest(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const body = (await request.json()) as Record<string, unknown>
    if ('operatorUserId' in body || 'customerAccountId' in body) {
      return NextResponse.json(
        { code: 'CLIENT_AUTHORITY_REJECTED', message: 'Client cannot set operator or account' },
        { status: 400 },
      )
    }
    const store = getAiWorkforceOrchestrationStore()
    const result =
      body.active === false
        ? resumeAccountWorkforce(store, {
            customerAccountId: portal.customerAccount.id,
            operatorUserId: portal.id,
          })
        : pauseAccountWorkforce(store, {
            customerAccountId: portal.customerAccount.id,
            operatorUserId: portal.id,
            reason: typeof body.reason === 'string' ? body.reason : undefined,
          })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: 409 })
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    console.error('ai workforce pause POST failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to update workforce pause' }, { status: 500 })
  }
}
