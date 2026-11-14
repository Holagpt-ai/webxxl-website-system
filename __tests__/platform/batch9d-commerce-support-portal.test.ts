import { describe, expect, it } from 'vitest'
import { CUSTOMER_REPLY_STATUSES } from '@/lib/portal/support-messages'
import { COMMERCE_API } from '@/lib/commerce-ui/api'

describe('Batch 9D — support reply gate', () => {
  it('allows customer replies while ticket is open or waiting on customer', () => {
    expect(CUSTOMER_REPLY_STATUSES).toContain('WAITING_ON_CUSTOMER')
    expect(CUSTOMER_REPLY_STATUSES).toContain('IN_PROGRESS')
    expect(CUSTOMER_REPLY_STATUSES).not.toContain('CLOSED')
  })
})

describe('Batch 9D — commerce API paths', () => {
  it('exposes ledger under billing group scope', () => {
    expect(COMMERCE_API.walletLedger('bg_test')).toBe('/api/v1/billing-groups/bg_test/ledger')
  })
})