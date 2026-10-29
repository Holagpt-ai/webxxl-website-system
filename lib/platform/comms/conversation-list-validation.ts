import { COMMS_LIST_DEFAULT_TAKE, COMMS_LIST_MAX_TAKE } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import type { CommsResult } from '@/lib/platform/comms/types'

export function parseConversationListTake(take: number | undefined): CommsResult<number> {
  if (take === undefined) return { ok: true, value: COMMS_LIST_DEFAULT_TAKE }
  if (!Number.isFinite(take) || !Number.isInteger(take)) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid take parameter' }
  }
  if (take < 1 || take > COMMS_LIST_MAX_TAKE) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid take parameter' }
  }
  return { ok: true, value: take }
}

export async function resolveVerifiedInboxExternalId(input: {
  customerAccountId: string
  inboxId: string
}): Promise<CommsResult<string>> {
  const inbox = await prisma.chatwootInboxMapping.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      verificationState: 'VERIFIED',
      OR: [{ id: input.inboxId }, { externalInboxId: input.inboxId }],
      tenantMapping: {
        customerAccountId: input.customerAccountId,
        revokedAt: null,
        verificationState: 'VERIFIED',
      },
    },
    select: { externalInboxId: true },
  })
  if (!inbox) {
    return { ok: false, code: 'VALIDATION', message: 'Inbox not available for this account' }
  }
  return { ok: true, value: inbox.externalInboxId }
}
