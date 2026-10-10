-- CreateEnum
CREATE TYPE "ManagedSiteStatus" AS ENUM ('ACTIVE', 'SETUP', 'DISCONNECTED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ManagedSitePlatform" AS ENUM ('NEXTJS', 'WORDPRESS', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "ManagedSiteConnectionType" AS ENUM ('WEBXXL_NATIVE', 'API', 'EXTERNAL_ADMIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "CapabilityExecutionMode" AS ENUM ('SELF_SERVICE', 'AI_ASSISTED', 'HUMAN_REQUIRED', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "ManagedSiteChangeStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'APPLIED', 'FAILED', 'CANCELLED', 'ESCALATED');

-- CreateTable
CREATE TABLE "ManagedSite" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "status" "ManagedSiteStatus" NOT NULL DEFAULT 'SETUP',
    "platform" "ManagedSitePlatform" NOT NULL DEFAULT 'OTHER',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "connectionType" "ManagedSiteConnectionType" NOT NULL DEFAULT 'MANUAL',
    "adapterKey" TEXT NOT NULL,
    "externalAdminUrl" TEXT,
    "connectionRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedSiteCapability" (
    "id" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "executionMode" "CapabilityExecutionMode",
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSiteCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedSiteChange" (
    "id" TEXT NOT NULL,
    "managedSiteId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "executionMode" "CapabilityExecutionMode" NOT NULL,
    "status" "ManagedSiteChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "requestText" TEXT,
    "structuredPayload" JSONB,
    "previewPayload" JSONB,
    "resultMetadata" JSONB,
    "changeRequestId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSiteChange_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ChangeRequest" ADD COLUMN "managedSiteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSite_domain_key" ON "ManagedSite"("domain");

-- CreateIndex
CREATE INDEX "ManagedSite_customerAccountId_idx" ON "ManagedSite"("customerAccountId");

-- CreateIndex
CREATE INDEX "ManagedSite_projectId_idx" ON "ManagedSite"("projectId");

-- CreateIndex
CREATE INDEX "ManagedSiteCapability_managedSiteId_idx" ON "ManagedSiteCapability"("managedSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSiteCapability_managedSiteId_capabilityKey_key" ON "ManagedSiteCapability"("managedSiteId", "capabilityKey");

-- CreateIndex
CREATE INDEX "ManagedSiteChange_managedSiteId_createdAt_idx" ON "ManagedSiteChange"("managedSiteId", "createdAt");

-- CreateIndex
CREATE INDEX "ManagedSiteChange_changeRequestId_idx" ON "ManagedSiteChange"("changeRequestId");

-- CreateIndex
CREATE INDEX "ChangeRequest_managedSiteId_idx" ON "ChangeRequest"("managedSiteId");

-- AddForeignKey
ALTER TABLE "ManagedSite" ADD CONSTRAINT "ManagedSite_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSite" ADD CONSTRAINT "ManagedSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSiteCapability" ADD CONSTRAINT "ManagedSiteCapability_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSiteChange" ADD CONSTRAINT "ManagedSiteChange_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSiteChange" ADD CONSTRAINT "ManagedSiteChange_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSiteChange" ADD CONSTRAINT "ManagedSiteChange_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSiteChange" ADD CONSTRAINT "ManagedSiteChange_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
