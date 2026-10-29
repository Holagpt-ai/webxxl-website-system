import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { UNRELATED_BUSINESS_ACCOUNT_ID } from '@/lib/platform/comms/test-fixtures-abmed-comms'

/** Two independent CustomerAccounts for pilot isolation tests (synthetic, non-clinical). */
export const PILOT_ACCOUNT_A_ID = ABMED_AESTHETICS_ACCOUNT_ID
export const PILOT_ACCOUNT_B_ID = ABMED_PHYSICIANS_ACCOUNT_ID

export const PILOT_UNRELATED_ACCOUNT_ID = UNRELATED_BUSINESS_ACCOUNT_ID

export const PILOT_SYNTHETIC_ACCOUNTS = [
  { id: PILOT_ACCOUNT_A_ID, label: 'ABMED Aesthetics (synthetic)' },
  { id: PILOT_ACCOUNT_B_ID, label: 'ABMED Physicians Group (synthetic)' },
] as const
