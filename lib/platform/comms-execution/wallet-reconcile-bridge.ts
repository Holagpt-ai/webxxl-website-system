import type { PrismaClient } from '@prisma/client'
import {
  dispatchStatusLabelFromOutcome,
  mapMessagingProviderLifecycleToOutcome,
  type MessagingLifecycleSignal,
} from '@/lib/platform/comms/dispatch-reconcile-policy'
import type { CommsResult } from '@/lib/platform/comms/types'
import { releaseReservation, settleReservation } from '@/lib/platform/wallet/durable-service'
import { buildProviderEventFingerprint } from '@/lib/platform/wallet/provider-reconciliation'

export type CommsWalletReconcileInput = {
  reservationId: string
  lifecycle: MessagingLifecycleSignal
  carrierDeliveryEvidence?: boolean
  providerEventId: string
  providerRef: string
  settleAmount?: number
}

export type CommsWalletReconcileResult = {
  dispatchStatus: string
  walletAction: 'SETTLED' | 'RELEASED' | 'RECONCILIATION_REQUIRED' | 'NONE'
  reservationId: string
  ledgerEntryId?: string
  eventFingerprint?: string
}

/**
 * Bridges communications provider lifecycle evidence to the existing durable wallet
 * settle/release path. Unknown or accepted-without-delivery outcomes stay held.
 * Does not invent carrier delivery. Uses wallet-settlement principal (comms-gateway is reserve-only).
 */
export async function reconcileCommsWalletAgainstDispatchOutcome(
  prisma: PrismaClient,
  input: CommsWalletReconcileInput,
): Promise<CommsResult<CommsWalletReconcileResult>> {
  const outcome = mapMessagingProviderLifecycleToOutcome({
    lifecycle: input.lifecycle,
    carrierDeliveryEvidence: input.carrierDeliveryEvidence,
  })
  const dispatchStatus = dispatchStatusLabelFromOutcome(outcome)
  const settlePrincipal = { kind: 'SERVICE' as const, serviceId: 'wallet-settlement' as const }

  if (outcome.kind === 'FAILED') {
    const released = await releaseReservation(prisma, {
      principal: settlePrincipal,
      reservationId: input.reservationId,
      idempotencyKey: `comms-release:${input.providerEventId}`,
    })
    if (!released.ok) {
      return { ok: false, code: 'FORBIDDEN', message: released.error }
    }
    return {
      ok: true,
      value: {
        dispatchStatus,
        walletAction: 'RELEASED',
        reservationId: input.reservationId,
      },
    }
  }

  if (outcome.kind === 'DELIVERED') {
    const amount = input.settleAmount
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, code: 'VALIDATION', message: 'Settle amount required for delivered reconciliation' }
    }
    const eventFingerprint = buildProviderEventFingerprint({
      providerKey: 'comms',
      externalEventId: input.providerEventId,
      payloadHash: input.providerRef,
      reservationId: input.reservationId,
      settleAmount: amount,
    })
    const settled = await settleReservation(prisma, {
      principal: settlePrincipal,
      reservationId: input.reservationId,
      amount,
      idempotencyKey: `comms-settle:${input.providerEventId}`,
      providerRef: input.providerRef,
    })
    if (!settled.ok) {
      return { ok: false, code: 'FORBIDDEN', message: settled.error }
    }
    return {
      ok: true,
      value: {
        dispatchStatus,
        walletAction: 'SETTLED',
        reservationId: input.reservationId,
        ledgerEntryId: settled.value.id,
        eventFingerprint,
      },
    }
  }

  return {
    ok: true,
    value: {
      dispatchStatus,
      walletAction: 'RECONCILIATION_REQUIRED',
      reservationId: input.reservationId,
    },
  }
}
