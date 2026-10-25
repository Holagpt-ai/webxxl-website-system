-- BATCH-15: First-party capture credentials, conversion observation unique counts, event consent fields.

ALTER TABLE "AnalyticsConversionObservation" ADD COLUMN "uniqueCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WebxxlConversionEvent" ADD COLUMN "consentGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebxxlConversionEvent" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "WebxxlConversionEvent" ADD COLUMN "pagePath" TEXT;
ALTER TABLE "WebxxlConversionEvent" ADD COLUMN "provenance" TEXT NOT NULL DEFAULT 'capture_api';
ALTER TABLE "WebxxlConversionEvent" ADD COLUMN "customConversionKey" TEXT;

CREATE TABLE "AnalyticsSiteCaptureCredential" (
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

    CONSTRAINT "AnalyticsSiteCaptureCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsSiteCaptureCredential_publicKeyId_key" ON "AnalyticsSiteCaptureCredential"("publicKeyId");
CREATE INDEX "AnalyticsSiteCaptureCredential_managedSiteId_enabled_idx" ON "AnalyticsSiteCaptureCredential"("managedSiteId", "enabled");
CREATE INDEX "AnalyticsSiteCaptureCredential_customerAccountId_idx" ON "AnalyticsSiteCaptureCredential"("customerAccountId");

ALTER TABLE "AnalyticsSiteCaptureCredential" ADD CONSTRAINT "AnalyticsSiteCaptureCredential_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSiteCaptureCredential" ADD CONSTRAINT "AnalyticsSiteCaptureCredential_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
