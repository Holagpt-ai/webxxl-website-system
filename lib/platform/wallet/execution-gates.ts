import {
  isWalletBackendEnabled,
  isWalletProviderReconciliationEnabled,
  isWalletRefundEnabled,
  isWalletReservationEnabled,
  isWalletSettlementEnabled,
} from '@/config/wallet-backend'
import type { WalletDenial } from '@/lib/platform/wallet/types'

export type WalletDurableOperation = 'RESERVE' | 'SETTLE' | 'REFUND' | 'RECONCILE'

/** Test-only bypass; impossible when NODE_ENV is production. */
export function isWalletTestExecutionBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.WALLET_TEST_EXECUTION_BYPASS === 'true'
}

function isWalletDurableExecutionAllowed(): boolean {
  return isWalletBackendEnabled() || isWalletTestExecutionBypassEnabled()
}

function denialForOperation(operation: WalletDurableOperation): WalletDenial {
  switch (operation) {
    case 'RESERVE':
      return 'UNAUTHORIZED_SPEND'
    case 'SETTLE':
    case 'RECONCILE':
      return 'UNAUTHORIZED_SETTLE'
    case 'REFUND':
      return 'UNAUTHORIZED_SETTLE'
  }
}

/** Enforced at durable service entry — SERVICE principals cannot bypass global disablement. */
export function walletDurableOperationDenial(operation: WalletDurableOperation): WalletDenial | null {
  if (!isWalletDurableExecutionAllowed()) {
    return denialForOperation(operation)
  }
  switch (operation) {
    case 'RESERVE':
      return isWalletReservationEnabled() ? null : 'UNAUTHORIZED_SPEND'
    case 'SETTLE':
      return isWalletSettlementEnabled() ? null : 'UNAUTHORIZED_SETTLE'
    case 'REFUND':
      return isWalletRefundEnabled() ? null : 'UNAUTHORIZED_SETTLE'
    case 'RECONCILE':
      return isWalletProviderReconciliationEnabled() ? null : 'UNAUTHORIZED_SETTLE'
  }
}
