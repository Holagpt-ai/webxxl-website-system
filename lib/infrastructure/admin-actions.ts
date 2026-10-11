'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireStaff } from '@/lib/portal/authz'
import {
  markInfrastructureSyncRequested,
  registerBusinessEmailService,
  registerHostingService,
  registerManagedDomain,
} from '@/lib/infrastructure/registry'
import type {
  BusinessEmailServiceStatus,
  DomainRenewalStatus,
  DomainVerificationStatus,
  HostingServiceStatus,
  HostingSslStatus,
  InfrastructureDataSource,
  InfrastructureManagementMode,
} from '@prisma/client'
import { prisma } from '@/lib/db'

export type InfrastructureAdminActionResult = { ok: true } | { ok: false; error: string }

function revalidateAdminInfrastructure() {
  revalidatePath('/admin/infrastructure')
  revalidatePath('/es/admin/infrastructure')
}

function parseDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function adminRegisterDomainAction(formData: FormData): Promise<void> {
  try {
    const staff = await requireStaff()
    const customerAccountId = String(formData.get('customerAccountId') ?? '')
    if (!customerAccountId) return
    const result = await registerManagedDomain({
      customerAccountId,
      domainName: String(formData.get('domainName') ?? ''),
      actorUserId: staff.id,
      registrar: String(formData.get('registrar') ?? '') || null,
      registeredAt: parseDate(String(formData.get('registeredAt') ?? '')),
      expiresAt: parseDate(String(formData.get('expiresAt') ?? '')),
      renewalStatus: (String(formData.get('renewalStatus') ?? 'UNKNOWN') as DomainRenewalStatus) || 'UNKNOWN',
      dnsProviderId: String(formData.get('dnsProviderId') ?? '') || null,
      verificationStatus: (String(formData.get('verificationStatus') ?? 'UNVERIFIED') as DomainVerificationStatus) || 'UNVERIFIED',
      dataSource: (String(formData.get('dataSource') ?? 'MANUAL') as InfrastructureDataSource) || 'MANUAL',
      providerReference: String(formData.get('providerReference') ?? '') || null,
      internalNotes: String(formData.get('internalNotes') ?? '') || null,
    })
    if (!result.ok) return
    revalidateAdminInfrastructure()
  } catch {
    return
  }
}

export async function adminRegisterHostingAction(formData: FormData): Promise<void> {
  try {
    const staff = await requireStaff()
    const customerAccountId = String(formData.get('customerAccountId') ?? '')
    if (!customerAccountId) return
    const projectId = String(formData.get('projectId') ?? '') || null
    const managedDomainId = String(formData.get('managedDomainId') ?? '') || null
    const result = await registerHostingService({
      customerAccountId,
      actorUserId: staff.id,
      providerId: String(formData.get('providerId') ?? 'manual'),
      projectId,
      managedDomainId,
      externalProviderRef: String(formData.get('externalProviderRef') ?? '') || null,
      planLabel: String(formData.get('planLabel') ?? '') || null,
      primaryDomain: String(formData.get('primaryDomain') ?? '') || null,
      status: (String(formData.get('status') ?? 'PENDING') as HostingServiceStatus) || 'PENDING',
      startedAt: parseDate(String(formData.get('startedAt') ?? '')),
      renewsAt: parseDate(String(formData.get('renewsAt') ?? '')),
      sslStatus: (String(formData.get('sslStatus') ?? 'UNKNOWN') as HostingSslStatus) || 'UNKNOWN',
      managementMode: (String(formData.get('managementMode') ?? 'MANUAL') as InfrastructureManagementMode) || 'MANUAL',
      dataSource: (String(formData.get('dataSource') ?? 'MANUAL') as InfrastructureDataSource) || 'MANUAL',
      notes: String(formData.get('notes') ?? '') || null,
      internalNotes: String(formData.get('internalNotes') ?? '') || null,
    })
    if (!result.ok) return
    revalidateAdminInfrastructure()
  } catch {
    return
  }
}

export async function adminRegisterEmailAction(formData: FormData): Promise<void> {
  try {
    const staff = await requireStaff()
    const customerAccountId = String(formData.get('customerAccountId') ?? '')
    if (!customerAccountId) return
    const managedDomainId = String(formData.get('managedDomainId') ?? '') || null
    const mailboxRaw = Number(formData.get('mailboxCount') ?? 0)
    const result = await registerBusinessEmailService({
      customerAccountId,
      actorUserId: staff.id,
      providerId: String(formData.get('providerId') ?? 'manual'),
      managedDomainId,
      planLabel: String(formData.get('planLabel') ?? '') || null,
      mailboxCount: Number.isFinite(mailboxRaw) ? mailboxRaw : 0,
      renewsAt: parseDate(String(formData.get('renewsAt') ?? '')),
      status: (String(formData.get('status') ?? 'PENDING') as BusinessEmailServiceStatus) || 'PENDING',
      externalProviderRef: String(formData.get('externalProviderRef') ?? '') || null,
      dataSource: (String(formData.get('dataSource') ?? 'MANUAL') as InfrastructureDataSource) || 'MANUAL',
      internalNotes: String(formData.get('internalNotes') ?? '') || null,
    })
    if (!result.ok) return
    revalidateAdminInfrastructure()
  } catch {
    return
  }
}

export async function adminMarkSyncRequestedAction(
  assetType: 'HOSTING' | 'DOMAIN' | 'EMAIL',
  assetId: string,
): Promise<InfrastructureAdminActionResult> {
  try {
    const staff = await requireStaff()
    await markInfrastructureSyncRequested({ assetType, assetId, actorUserId: staff.id })
    revalidateAdminInfrastructure()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function adminMarkSyncRequestedFormAction(formData: FormData): Promise<void> {
  const assetType = String(formData.get('assetType') ?? '') as 'HOSTING' | 'DOMAIN' | 'EMAIL'
  const assetId = String(formData.get('assetId') ?? '')
  if (!assetId || !['HOSTING', 'DOMAIN', 'EMAIL'].includes(assetType)) return
  await adminMarkSyncRequestedAction(assetType, assetId)
}

/** Provider credential configuration — admin only; stores nothing secret in Batch 12. */
export async function adminSetProviderConfigNoteAction(formData: FormData): Promise<InfrastructureAdminActionResult> {
  try {
    await requireAdmin()
    const providerId = String(formData.get('providerId') ?? '').trim()
    const note = String(formData.get('configNote') ?? '').trim()
    if (!providerId) return { ok: false, error: 'missing_provider' }
    if (note.length > 2000) return { ok: false, error: 'note_too_long' }
    // Placeholder: future secure credential vault. No secrets persisted in v1.
    void note
    revalidateAdminInfrastructure()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function adminUpdateHostingNotesAction(
  hostingId: string,
  notes: string,
  internalNotes: string,
): Promise<InfrastructureAdminActionResult> {
  try {
    const staff = await requireStaff()
    await prisma.hostingService.update({
      where: { id: hostingId },
      data: {
        notes: notes.trim() || null,
        internalNotes: internalNotes.trim() || null,
      },
    })
    const row = await prisma.hostingService.findUnique({ where: { id: hostingId } })
    if (row) {
      await prisma.infrastructureActivity.create({
        data: {
          assetType: 'HOSTING',
          assetId: hostingId,
          customerAccountId: row.customerAccountId,
          actorUserId: staff.id,
          summary: 'Hosting record updated by staff',
        },
      })
    }
    revalidateAdminInfrastructure()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
