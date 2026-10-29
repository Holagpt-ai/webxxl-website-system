import { describe, expect, it } from 'vitest'
import { commsWorkspaceEn } from '@/lib/i18n/dictionaries/comms-workspace-en'
import { commsWorkspaceEs } from '@/lib/i18n/dictionaries/comms-workspace-es'
import {
  COMMS_API,
  CONVERSATION_FILTERS,
  channelFromInboxType,
  connectionDisplayState,
  isFilterableInbox,
  parseConversationFilter,
} from '@/lib/comms-ui/types'
import { withQuery } from '@/lib/crm-ui/workspace'
import { localizePath } from '@/lib/i18n/localize'

describe('Batch 20C communications UI contract', () => {
  it('lists every conversation filter from BATCH20B', () => {
    expect([...CONVERSATION_FILTERS]).toEqual([
      'open',
      'pending',
      'resolved',
      'assigned',
      'assigned_to_me',
      'unassigned',
      'needs_attention',
    ])
    expect(parseConversationFilter('open')).toBe('open')
    expect(parseConversationFilter('nope')).toBe('')
  })

  it('builds list URLs with inboxId and cursor query keys', () => {
    const url = withQuery(COMMS_API.conversations, {
      take: 50,
      filter: 'open',
      inboxId: 'inbox_map_1',
      channel: 'web_chat',
      cursor: 'abc',
    })
    expect(url).toContain('inboxId=inbox_map_1')
    expect(url).toContain('cursor=abc')
    expect(url).not.toContain('inbox=')
  })

  it('filters inboxes to verified tenant mappings only', () => {
    expect(
      isFilterableInbox({
        id: '1',
        externalInboxId: 'ext',
        channelType: 'web',
        verificationState: 'VERIFIED',
        tenantVerificationState: 'VERIFIED',
        tenantRevoked: false,
        visibilityState: 'VERIFIED',
        lastSyncAt: null,
        syncStale: false,
      }),
    ).toBe(true)
    expect(
      isFilterableInbox({
        id: '1',
        externalInboxId: 'ext',
        channelType: 'web',
        verificationState: 'PENDING',
        tenantVerificationState: 'VERIFIED',
        tenantRevoked: false,
        visibilityState: 'MAPPING_PENDING',
        lastSyncAt: null,
        syncStale: false,
      }),
    ).toBe(false)
  })

  it('maps connection display without claiming live Chatwoot', () => {
    expect(
      connectionDisplayState({
        configured: false,
        authorizedInboxCount: 0,
        verifiedInboxCount: 0,
        disconnected: true,
        mappingPending: false,
        staleSyncRisk: false,
        dataState: 'NOT_CONNECTED',
        summary: 'Chatwoot is not configured for this account',
      }),
    ).toBe('NOT_CONNECTED')
    expect(
      connectionDisplayState({
        configured: true,
        verificationState: 'VERIFIED',
        authorizedInboxCount: 1,
        verifiedInboxCount: 1,
        disconnected: true,
        mappingPending: false,
        staleSyncRisk: false,
        dataState: 'DISCONNECTED',
        summary: 'Chatwoot mapping revoked',
      }),
    ).toBe('DISCONNECTED')
  })

  it('localizes EN and ES workspace bases', () => {
    expect(localizePath('en', '/dashboard/communications')).toBe('/dashboard/communications')
    expect(localizePath('es', '/dashboard/communications')).toBe('/es/dashboard/communications')
    expect(localizePath('es', '/dashboard/communications/conversations/c1')).toBe(
      '/es/dashboard/communications/conversations/c1',
    )
  })

  it('loads EN and ES workspace copy', () => {
    expect(commsWorkspaceEn.name).toBeTruthy()
    expect(commsWorkspaceEs.name).toBeTruthy()
    expect(commsWorkspaceEn.distinction).toMatch(/Messages/i)
    expect(commsWorkspaceEs.distinction.length).toBeGreaterThan(10)
  })

  it('maps inbox channel types for filter options', () => {
    expect(channelFromInboxType('Channel::WebWidget')).toBe('web_chat')
    expect(channelFromInboxType('sms')).toBe('sms')
  })
})
