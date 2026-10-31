-- Batch 28A: managed-site lead intake and CRM qualification (source only; not applied to production by Cursor)

CREATE TYPE "ManagedSiteLeadStatus" AS ENUM (
  'RECEIVED',
  'PENDING_REVIEW',
  'QUALIFIED',
  'REJECTED',
  'CONVERTED',
  'DUPLICATE_REVIEW'
);

CREATE TABLE "ManagedSiteLeadIntakeCredential" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "publicKeyId" TEXT NOT NULL,
    "secretRef" TEXT,
    "secretHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSiteLeadIntakeCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagedSiteLeadIntakeRateWindow" (
    "publicKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSiteLeadIntakeRateWindow_pkey" PRIMARY KEY ("publicKeyId","windowStart")
);

CREATE TABLE "ManagedSiteLead" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "status" "ManagedSiteLeadStatus" NOT NULL DEFAULT 'RECEIVED',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "formReference" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "normalizedEmail" TEXT NOT NULL,
    "normalizedPhone" TEXT,
    "message" TEXT,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "submissionFingerprint" TEXT NOT NULL,
    "sourceAttribution" JSONB,
    "analyticsEventRef" TEXT,
    "crmContactId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "duplicateOfLeadId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "convertIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSiteLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedSiteLeadIntakeCredential_publicKeyId_key" ON "ManagedSiteLeadIntakeCredential"("publicKeyId");
CREATE INDEX "ManagedSiteLeadIntakeCredential_managedSiteId_enabled_idx" ON "ManagedSiteLeadIntakeCredential"("managedSiteId", "enabled");
CREATE INDEX "ManagedSiteLeadIntakeCredential_customerAccountId_idx" ON "ManagedSiteLeadIntakeCredential"("customerAccountId");
CREATE INDEX "ManagedSiteLeadIntakeRateWindow_expiresAt_idx" ON "ManagedSiteLeadIntakeRateWindow"("expiresAt");

CREATE UNIQUE INDEX "ManagedSiteLead_idempotencyKey_key" ON "ManagedSiteLead"("idempotencyKey");
CREATE UNIQUE INDEX "ManagedSiteLead_convertIdempotencyKey_key" ON "ManagedSiteLead"("convertIdempotencyKey");
CREATE INDEX "ManagedSiteLead_customerAccountId_status_createdAt_idx" ON "ManagedSiteLead"("customerAccountId", "status", "createdAt");
CREATE INDEX "ManagedSiteLead_managedSiteId_createdAt_idx" ON "ManagedSiteLead"("managedSiteId", "createdAt");
CREATE INDEX "ManagedSiteLead_customerAccountId_normalizedEmail_idx" ON "ManagedSiteLead"("customerAccountId", "normalizedEmail");
CREATE INDEX "ManagedSiteLead_submissionFingerprint_createdAt_idx" ON "ManagedSiteLead"("submissionFingerprint", "createdAt");

ALTER TABLE "ManagedSiteLeadIntakeCredential" ADD CONSTRAINT "ManagedSiteLeadIntakeCredential_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedSiteLeadIntakeCredential" ADD CONSTRAINT "ManagedSiteLeadIntakeCredential_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ManagedSiteLead" ADD CONSTRAINT "ManagedSiteLead_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedSiteLead" ADD CONSTRAINT "ManagedSiteLead_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedSiteLead" ADD CONSTRAINT "ManagedSiteLead_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedSiteLead" ADD CONSTRAINT "ManagedSiteLead_duplicateOfLeadId_fkey" FOREIGN KEY ("duplicateOfLeadId") REFERENCES "ManagedSiteLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
