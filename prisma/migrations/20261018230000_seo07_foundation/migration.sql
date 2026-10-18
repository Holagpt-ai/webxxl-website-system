-- CreateEnum
CREATE TYPE "SeoDataState" AS ENUM ('NOT_CONNECTED', 'FETCHING', 'READY', 'PARTIAL', 'STALE', 'ERROR', 'NOT_SUPPORTED');

-- CreateEnum
CREATE TYPE "SeoAnalyticsProvider" AS ENUM ('GSC', 'GA4', 'GBP', 'PLACES', 'RANK_VENDOR', 'WEBXXL_CRAWL');

-- CreateEnum
CREATE TYPE "SeoPageInventoryStatus" AS ENUM ('DISCOVERED', 'CRAWLED', 'DRAFT', 'PREVIEW', 'PUBLISHED', 'REMOVED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "SeoCrawlRunStatus" AS ENUM ('PREPARED', 'RUNNING', 'COMPLETED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoOpportunityState" AS ENUM ('OBSERVED_FINDING', 'RECOMMENDED_ACTION', 'DRAFT_PREPARED', 'AWAITING_APPROVAL', 'APPROVED', 'PUBLISHED', 'VERIFIED_OUTCOME');

-- CreateEnum
CREATE TYPE "SeoConnectionVerificationState" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateTable
CREATE TABLE "SiteAnalyticsConnection" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "provider" "SeoAnalyticsProvider" NOT NULL,
    "propertyRef" TEXT NOT NULL,
    "propertyKind" TEXT NOT NULL,
    "secretRef" TEXT,
    "verificationState" "SeoConnectionVerificationState" NOT NULL DEFAULT 'PENDING',
    "readScopes" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "dataState" "SeoDataState" NOT NULL DEFAULT 'NOT_CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAnalyticsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSiteProfile" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "canonicalHost" TEXT NOT NULL,
    "marketCategory" TEXT,
    "services" JSONB,
    "geoCenter" JSONB,
    "serviceAreaKm" DOUBLE PRECISION,
    "targetLanguage" TEXT NOT NULL DEFAULT 'en',
    "keywordThemes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSiteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoCrawlRun" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "status" "SeoCrawlRunStatus" NOT NULL DEFAULT 'PREPARED',
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL DEFAULT 'SCAN_PREVIEW',
    "requestFingerprint" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL,
    "maxDepth" INTEGER NOT NULL,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "bytesDownloaded" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoCrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePageInventory" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "status" "SeoPageInventoryStatus" NOT NULL DEFAULT 'DISCOVERED',
    "httpStatus" INTEGER,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "canonicalUrl" TEXT,
    "provenanceRef" TEXT,
    "lastCrawledAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "websitePreviewVersionId" TEXT,
    "managedSiteChangeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePageInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoPageFinding" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "crawlRunId" TEXT,
    "pageInventoryId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "detail" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoPageFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSnapshot" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "provider" "SeoAnalyticsProvider" NOT NULL,
    "propertyRef" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "dataState" "SeoDataState" NOT NULL,
    "sourceCompleteness" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "methodologyVersion" TEXT NOT NULL,

    CONSTRAINT "SeoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoMetricObservation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "provider" "SeoAnalyticsProvider" NOT NULL,
    "metricDefinition" TEXT NOT NULL,
    "dimension" TEXT,
    "dimensionValue" TEXT,
    "value" DOUBLE PRECISION,
    "dataState" "SeoDataState" NOT NULL,
    "date" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "SeoMetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordObservation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "provider" "SeoAnalyticsProvider" NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT,
    "clicks" INTEGER,
    "impressions" INTEGER,
    "ctr" DOUBLE PRECISION,
    "averagePosition" DOUBLE PRECISION,
    "dataState" "SeoDataState" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "SeoKeywordObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorMarket" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "services" JSONB,
    "geoCenter" JSONB,
    "radiusKm" DOUBLE PRECISION,
    "language" TEXT NOT NULL DEFAULT 'en',
    "keywordThemes" JSONB,
    "sourceMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorProfile" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "placeId" TEXT,
    "categoryMatch" DOUBLE PRECISION,
    "serviceOverlap" DOUBLE PRECISION,
    "geoRelevance" DOUBLE PRECISION,
    "rankScore" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorObservation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "competitorRef" TEXT NOT NULL,
    "observationKind" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "CompetitorObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalRankObservation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchSurface" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "device" TEXT,
    "language" TEXT,
    "rankPosition" INTEGER,
    "dataState" "SeoDataState" NOT NULL DEFAULT 'NOT_CONNECTED',
    "providerKey" TEXT,
    "method" TEXT,
    "observedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limitations" JSONB,

    CONSTRAINT "LocalRankObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoOpportunity" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "state" "SeoOpportunityState" NOT NULL DEFAULT 'OBSERVED_FINDING',
    "severity" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "impactRationale" TEXT NOT NULL,
    "effortCategory" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "affectedUrl" TEXT,
    "evidenceRef" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoWorkEvidence" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "workKind" TEXT NOT NULL,
    "resourceRef" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB,

    CONSTRAINT "SeoWorkEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoProviderSyncRun" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "provider" "SeoAnalyticsProvider" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dataState" "SeoDataState" NOT NULL DEFAULT 'FETCHING',
    "quotaBudget" INTEGER,
    "errorClass" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SeoProviderSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteAnalyticsConnection_managedSiteId_provider_propertyRef_key" ON "SiteAnalyticsConnection"("managedSiteId", "provider", "propertyRef");

-- CreateIndex
CREATE INDEX "SiteAnalyticsConnection_customerAccountId_provider_dataState_idx" ON "SiteAnalyticsConnection"("customerAccountId", "provider", "dataState");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSiteProfile_managedSiteId_key" ON "SeoSiteProfile"("managedSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoCrawlRun_idempotencyKey_key" ON "SeoCrawlRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SeoCrawlRun_managedSiteId_createdAt_idx" ON "SeoCrawlRun"("managedSiteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitePageInventory_managedSiteId_normalizedPath_key" ON "SitePageInventory"("managedSiteId", "normalizedPath");

-- CreateIndex
CREATE INDEX "SitePageInventory_customerAccountId_status_idx" ON "SitePageInventory"("customerAccountId", "status");

-- CreateIndex
CREATE INDEX "SeoPageFinding_managedSiteId_ruleId_idx" ON "SeoPageFinding"("managedSiteId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSnapshot_managedSiteId_provider_propertyRef_dateRangeStart_dateRangeEnd_methodologyVersion_key" ON "SeoSnapshot"("managedSiteId", "provider", "propertyRef", "dateRangeStart", "dateRangeEnd", "methodologyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SeoMetricObservation_idempotencyKey_key" ON "SeoMetricObservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SeoMetricObservation_managedSiteId_metricDefinition_date_idx" ON "SeoMetricObservation"("managedSiteId", "metricDefinition", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordObservation_idempotencyKey_key" ON "SeoKeywordObservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SeoKeywordObservation_managedSiteId_date_idx" ON "SeoKeywordObservation"("managedSiteId", "date");

-- CreateIndex
CREATE INDEX "CompetitorMarket_managedSiteId_idx" ON "CompetitorMarket"("managedSiteId");

-- CreateIndex
CREATE INDEX "CompetitorProfile_marketId_rankScore_idx" ON "CompetitorProfile"("marketId", "rankScore");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorObservation_idempotencyKey_key" ON "CompetitorObservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LocalRankObservation_managedSiteId_keyword_idx" ON "LocalRankObservation"("managedSiteId", "keyword");

-- CreateIndex
CREATE INDEX "SeoOpportunity_managedSiteId_priorityScore_idx" ON "SeoOpportunity"("managedSiteId", "priorityScore");

-- CreateIndex
CREATE INDEX "SeoWorkEvidence_managedSiteId_observedAt_idx" ON "SeoWorkEvidence"("managedSiteId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoProviderSyncRun_idempotencyKey_key" ON "SeoProviderSyncRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SeoProviderSyncRun_managedSiteId_provider_status_idx" ON "SeoProviderSyncRun"("managedSiteId", "provider", "status");

-- AddForeignKey
ALTER TABLE "SiteAnalyticsConnection" ADD CONSTRAINT "SiteAnalyticsConnection_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAnalyticsConnection" ADD CONSTRAINT "SiteAnalyticsConnection_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSiteProfile" ADD CONSTRAINT "SeoSiteProfile_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSiteProfile" ADD CONSTRAINT "SeoSiteProfile_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoCrawlRun" ADD CONSTRAINT "SeoCrawlRun_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoCrawlRun" ADD CONSTRAINT "SeoCrawlRun_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePageInventory" ADD CONSTRAINT "SitePageInventory_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePageInventory" ADD CONSTRAINT "SitePageInventory_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPageFinding" ADD CONSTRAINT "SeoPageFinding_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPageFinding" ADD CONSTRAINT "SeoPageFinding_pageInventoryId_fkey" FOREIGN KEY ("pageInventoryId") REFERENCES "SitePageInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPageFinding" ADD CONSTRAINT "SeoPageFinding_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSnapshot" ADD CONSTRAINT "SeoSnapshot_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoMetricObservation" ADD CONSTRAINT "SeoMetricObservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordObservation" ADD CONSTRAINT "SeoKeywordObservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorMarket" ADD CONSTRAINT "CompetitorMarket_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorMarket" ADD CONSTRAINT "CompetitorMarket_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProfile" ADD CONSTRAINT "CompetitorProfile_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "CompetitorMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorProfile" ADD CONSTRAINT "CompetitorProfile_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalRankObservation" ADD CONSTRAINT "LocalRankObservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoOpportunity" ADD CONSTRAINT "SeoOpportunity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoOpportunity" ADD CONSTRAINT "SeoOpportunity_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoWorkEvidence" ADD CONSTRAINT "SeoWorkEvidence_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoProviderSyncRun" ADD CONSTRAINT "SeoProviderSyncRun_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoProviderSyncRun" ADD CONSTRAINT "SeoProviderSyncRun_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
