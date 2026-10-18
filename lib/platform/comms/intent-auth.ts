import { prisma } from '@/lib/db'
import type { CommsDataClassification } from '@prisma/client'

/** Client-supplied classification cannot downgrade regulated workflows. */
export function resolveServerDataClassification(input: {
  clientClassification?: CommsDataClassification
  senderClassification?: CommsDataClassification | null
}): CommsDataClassification {
  const sender = input.senderClassification ?? 'GENERAL_BUSINESS'
  const client = input.clientClassification ?? 'GENERAL_BUSINESS'
  if (sender === 'REGULATED_HEALTHCARE' || client === 'REGULATED_HEALTHCARE') {
    return 'REGULATED_HEALTHCARE'
  }
  if (sender === 'CREDENTIAL' || client === 'CREDENTIAL') return 'CREDENTIAL'
  if (sender === 'SECURITY_AUDIT' || client === 'SECURITY_AUDIT') return 'SECURITY_AUDIT'
  if (sender === 'BILLING' || client === 'BILLING') return 'BILLING'
  return 'GENERAL_BUSINESS'
}

/** Never trust client aiActor=false when an communication tool grant exists for the actor. */
export async function resolveEffectiveAiActor(input: {
  actorUserId: string
  customerAccountId: string
  clientAiActor?: boolean
}): Promise<boolean> {
  const grant = await prisma.agentToolGrant.findFirst({
    where: {
      actorId: input.actorUserId,
      customerAccountId: input.customerAccountId,
      toolKey: { in: ['communication.send', 'communication.prepare', 'crm.communication'] },
    },
  })
  if (grant) return true
  return input.clientAiActor === true
}
