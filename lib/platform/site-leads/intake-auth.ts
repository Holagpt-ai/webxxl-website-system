import { prisma } from '@/lib/db'
import {
  resolveSiteLeadIntakeSecretMaterial,
  verifySiteLeadIntakeSignature,
} from '@/lib/platform/site-leads/signature-auth'

export type IntakeCredentialContext = {
  publicKeyId: string
  customerAccountId: string
  managedSiteId: string
  secret: string
  siteDomain: string
}

export type IntakeAuthFailure = { ok: false; code: string; message: string; status: number }

export async function authenticateSiteLeadIntakeRequest(input: {
  publicKeyId: string
  signatureHeader: string | null
  timestampHeader: string | null
  rawBody: string
}): Promise<{ ok: true; ctx: IntakeCredentialContext } | IntakeAuthFailure> {
  const credential = await prisma.managedSiteLeadIntakeCredential.findUnique({
    where: { publicKeyId: input.publicKeyId },
    select: {
      publicKeyId: true,
      secretRef: true,
      secretHash: true,
      enabled: true,
      revokedAt: true,
      customerAccountId: true,
      managedSiteId: true,
    },
  })
  if (!credential || !credential.enabled || credential.revokedAt) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid lead intake key', status: 401 }
  }
  const site = await prisma.managedSite.findFirst({
    where: {
      id: credential.managedSiteId,
      customerAccountId: credential.customerAccountId,
      status: { in: ['ACTIVE', 'SETUP'] },
    },
    select: { id: true, domain: true },
  })
  if (!site) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Lead intake site binding invalid', status: 401 }
  }
  const secretMaterial = resolveSiteLeadIntakeSecretMaterial({
    publicKeyId: credential.publicKeyId,
    secretRef: credential.secretRef,
    secretHash: credential.secretHash,
  })
  if (!secretMaterial.ok) {
    return { ok: false, code: secretMaterial.code, message: secretMaterial.message, status: 503 }
  }
  const verified = verifySiteLeadIntakeSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    secret: secretMaterial.secret,
  })
  if (!verified.ok) {
    return { ok: false, code: verified.code, message: verified.message, status: 401 }
  }
  return {
    ok: true,
    ctx: {
      publicKeyId: credential.publicKeyId,
      customerAccountId: credential.customerAccountId,
      managedSiteId: credential.managedSiteId,
      secret: secretMaterial.secret,
      siteDomain: site.domain,
    },
  }
}
