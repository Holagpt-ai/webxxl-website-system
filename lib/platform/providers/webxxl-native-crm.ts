import { isCrmBackendEnabled, isCrmExternalSyncEnabled } from '@/config/crm-backend'
import { createCrmContact, getCrmContactForAccount } from '@/lib/platform/crm/contact-service'
import { createCrmCompany } from '@/lib/platform/crm/company-service'
import { createCrmDeal, ensureDefaultPipeline } from '@/lib/platform/crm/pipeline-service'
import { createCrmTask } from '@/lib/platform/crm/task-service'
import type { CrmProvider, CrmProviderCapabilities, ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'

function disabled<T>(message: string): ProviderResult<T> {
  return { ok: false, code: 'NOT_CONFIGURED', message }
}

const NATIVE_CAPABILITIES: CrmProviderCapabilities = {
  contacts: true,
  companies: true,
  pipelines: true,
  deals: true,
  tasks: true,
  customFields: true,
  activities: true,
  sync: false,
  export: true,
}

export function createWebxxlNativeCrmProvider(): CrmProvider {
  return {
    kind: 'crm',
    key: 'webxxl-native',
    displayName: 'WebXXL Native CRM',
    availability: 'EXISTING_ADAPTER',
    replaceable: true,
    installed: true,
    describeCapabilities() {
      return NATIVE_CAPABILITIES
    },
    async searchContacts(context, query) {
      if (!isCrmBackendEnabled()) return disabled('CRM_BACKEND_ENABLED is false')
      if (!context.customerAccountId) return disabled('Customer account required')
      // Native search uses Prisma in API routes; provider defers to service layer in CRM-05 batch.
      void query
      return { ok: true, value: [] }
    },
    async getContact(context, contactId) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      const row = await getCrmContactForAccount(contactId, context.customerAccountId)
      if (!row.ok) return { ok: false, code: 'DENIED', message: row.message }
      const email = row.value.channelIdentities.find((i) => i.identityType === 'EMAIL')?.displayValue
      return {
        ok: true,
        value: {
          id: row.value.id,
          displayName: row.value.preferredName ?? row.value.givenName ?? 'Contact',
          primaryEmail: email,
        },
      }
    },
    async createContact(context, input) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      const created = await createCrmContact({
        customerAccountId: context.customerAccountId,
        preferredName: input.displayName,
        emails: input.email ? [input.email] : undefined,
        phones: input.phone ? [input.phone] : undefined,
        idempotencyKey: context.idempotencyKey,
      })
      if (!created.ok) return { ok: false, code: 'DENIED', message: created.message }
      return { ok: true, value: { id: created.value.id } }
    },
    async searchCompanies(context, query) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      void context
      void query
      return { ok: true, value: [] }
    },
    async listPipelines(context) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      const pipeline = await ensureDefaultPipeline(context.customerAccountId)
      if (!pipeline.ok) return { ok: false, code: 'UNAVAILABLE', message: pipeline.message }
      return {
        ok: true,
        value: [
          {
            id: pipeline.value.pipelineId,
            name: 'Default',
            stages: pipeline.value.stageIds.map((id, index) => ({ id, name: `Stage ${index + 1}`, sortOrder: index + 1 })),
          },
        ],
      }
    },
    async createDeal(context, input) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      const created = await createCrmDeal({
        customerAccountId: context.customerAccountId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        title: input.title,
        contactId: input.contactId,
      })
      if (!created.ok) return { ok: false, code: 'DENIED', message: created.message }
      return { ok: true, value: { id: created.value.id } }
    },
    async listTasks(context) {
      if (!isCrmBackendEnabled()) return disabled('CRM backend disabled')
      void context
      return { ok: true, value: [] }
    },
    async syncWorkspace(context) {
      if (!isCrmExternalSyncEnabled()) return disabled('CRM_EXTERNAL_SYNC_ENABLED is false')
      void context
      return { ok: true, value: { accepted: false } }
    },
  }
}

// Optional helpers used by tests
export async function nativeCreateCompany(context: ProviderAuthContext, name: string) {
  return createCrmCompany({ customerAccountId: context.customerAccountId, name })
}

export async function nativeCreateTask(context: ProviderAuthContext, title: string) {
  return createCrmTask({
    customerAccountId: context.customerAccountId,
    title,
    idempotencyKey: context.idempotencyKey,
  })
}
