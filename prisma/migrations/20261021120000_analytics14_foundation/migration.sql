-- BATCH-14: Analytics conversion definitions, observations, and first-party events.
-- Reuses SEO-07 connection/snapshot/metric tables for provider ingestion.

-- AlterEnum
ALTER TYPE "SeoAnalyticsProvider" ADD VALUE 'WEBXXL_EVENTS';

-- CreateEnum
CREATE TYPE "AnalyticsConversionSourceKind" AS ENUM ('WEBXXL_FIRST_PARTY', 'GA4_IMPORTED', 'OPERATOR_DEFINED');

-- CreateTable
CREATE TABLE "AnalyticsConversionDefinition" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "publicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sourceKind" "AnalyticsConversionSourceKind" NOT NULL DEFAULT 'WEBXXL_FIRST_PARTY',
    "matchEventKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConversionDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsConversionObservation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "definitionId" TEXT,
    "conversionKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "value" DOUBLE PRECISION,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "dataState" "SeoDataState" NOT NULL DEFAULT 'READY',
    "sourceProvider" "SeoAnalyticsProvider" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "AnalyticsConversionObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebxxlConversionEvent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "eventKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "visitorRef" TEXT,
    "sessionRef" TEXT,
    "payload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebxxlConversionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsConversionDefinition_publicId_key" ON "AnalyticsConversionDefinition"("publicId");
CREATE UNIQUE INDEX "AnalyticsConversionDefinition_customerAccountId_key_key" ON "AnalyticsConversionDefinition"("customerAccountId", "key");
CREATE INDEX "AnalyticsConversionDefinition_customerAccountId_isActive_idx" ON "AnalyticsConversionDefinition"("customerAccountId", "isActive");

CREATE UNIQUE INDEX "AnalyticsConversionObservation_idempotencyKey_key" ON "AnalyticsConversionObservation"("idempotencyKey");
CREATE INDEX "AnalyticsConversionObservation_managedSiteId_periodDate_idx" ON "AnalyticsConversionObservation"("managedSiteId", "periodDate");
CREATE INDEX "AnalyticsConversionObservation_customerAccountId_conversionKey_peri_idx" ON "AnalyticsConversionObservation"("customerAccountId", "conversionKey", "periodDate");

CREATE UNIQUE INDEX "WebxxlConversionEvent_idempotencyKey_key" ON "WebxxlConversionEvent"("idempotencyKey");
CREATE INDEX "WebxxlConversionEvent_customerAccountId_eventKey_occurredAt_idx" ON "WebxxlConversionEvent"("customerAccountId", "eventKey", "occurredAt");
CREATE INDEX "WebxxlConversionEvent_managedSiteId_occurredAt_idx" ON "WebxxlConversionEvent"("managedSiteId", "occurredAt");

ALTER TABLE "AnalyticsConversionDefinition" ADD CONSTRAINT "AnalyticsConversionDefinition_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsConversionDefinition" ADD CONSTRAINT "AnalyticsConversionDefinition_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsConversionObservation" ADD CONSTRAINT "AnalyticsConversionObservation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsConversionObservation" ADD CONSTRAINT "AnalyticsConversionObservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsConversionObservation" ADD CONSTRAINT "AnalyticsConversionObservation_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AnalyticsConversionDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebxxlConversionEvent" ADD CONSTRAINT "WebxxlConversionEvent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebxxlConversionEvent" ADD CONSTRAINT "WebxxlConversionEvent_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
