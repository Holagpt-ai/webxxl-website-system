-- SOCIAL-04 Marketing Studio (additive)

CREATE TYPE "SocialChannelConnectionState" AS ENUM ('NOT_CONNECTED', 'PENDING_AUTHORIZATION', 'CONNECTED', 'DEGRADED', 'EXPIRED', 'REVOKED', 'UNAVAILABLE');
CREATE TYPE "SocialCampaignStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'SCHEDULING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');
CREATE TYPE "SocialPublicationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'SCHEDULING_UNKNOWN', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SocialSchedulingIntentStatus" AS ENUM ('PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'UNKNOWN', 'FAILED', 'CANCELLED');
CREATE TYPE "MarketingRequestType" AS ENUM ('SOCIAL_CAMPAIGN', 'SOCIAL_POST', 'LANDING_PAGE', 'AD_CREATIVE', 'SEO_FIX', 'CAMPAIGN_PLAN');
CREATE TYPE "MarketingRequestStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');
CREATE TYPE "MarketingArtifactType" AS ENUM ('SOCIAL_CAMPAIGN', 'SOCIAL_POST', 'LANDING_PAGE', 'AD_CREATIVE', 'SEO_FIX', 'CAMPAIGN_PLAN');
CREATE TYPE "SocialApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');

CREATE TABLE "SocialProviderWorkspaceMapping" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT 'postiz',
    "externalWorkspaceRef" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "connectionState" "SocialChannelConnectionState" NOT NULL DEFAULT 'NOT_CONNECTED',
    "authorizedByUserId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialProviderWorkspaceMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialProviderWorkspaceMapping_customerAccountId_providerKey_externalWorkspaceRef_key" ON "SocialProviderWorkspaceMapping"("customerAccountId", "providerKey", "externalWorkspaceRef");
CREATE INDEX "SocialProviderWorkspaceMapping_customerAccountId_connectionState_idx" ON "SocialProviderWorkspaceMapping"("customerAccountId", "connectionState");

CREATE TABLE "BusinessSocialConnection" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "workspaceMappingId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL DEFAULT 'postiz',
    "platform" TEXT NOT NULL,
    "externalChannelRef" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "connectionState" "SocialChannelConnectionState" NOT NULL DEFAULT 'NOT_CONNECTED',
    "permissions" JSONB,
    "secretRef" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSocialConnection_customerAccountId_externalChannelRef_key" ON "BusinessSocialConnection"("customerAccountId", "externalChannelRef");
CREATE INDEX "BusinessSocialConnection_customerAccountId_connectionState_idx" ON "BusinessSocialConnection"("customerAccountId", "connectionState");

CREATE TABLE "SocialCampaign" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "targetAudience" TEXT,
    "brandProfile" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "targetPlatforms" JSONB NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "SocialCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "activeRevisionId" TEXT,
    "approvedRevisionId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialCampaign_customerAccountId_status_idx" ON "SocialCampaign"("customerAccountId", "status");
CREATE INDEX "SocialCampaign_managedSiteId_createdAt_idx" ON "SocialCampaign"("managedSiteId", "createdAt");

CREATE TABLE "SocialCampaignRevision" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "captionEn" TEXT NOT NULL,
    "captionEs" TEXT,
    "mediaRefs" JSONB NOT NULL,
    "platformPayloads" JSONB NOT NULL,
    "targetChannelIds" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCampaignRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialCampaignRevision_campaignId_revisionNumber_key" ON "SocialCampaignRevision"("campaignId", "revisionNumber");
CREATE INDEX "SocialCampaignRevision_campaignId_contentHash_idx" ON "SocialCampaignRevision"("campaignId", "contentHash");

CREATE TABLE "SocialCampaignApproval" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "status" "SocialApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "contentHash" TEXT NOT NULL,
    "approvedScope" JSONB,
    "policyVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCampaignApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialCampaignApproval_campaignId_status_idx" ON "SocialCampaignApproval"("campaignId", "status");

CREATE TABLE "SocialSchedulingIntent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "SocialSchedulingIntentStatus" NOT NULL DEFAULT 'PENDING',
    "externalPostRef" TEXT,
    "dispatchLeaseOwner" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSchedulingIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialSchedulingIntent_idempotencyKey_key" ON "SocialSchedulingIntent"("idempotencyKey");
CREATE INDEX "SocialSchedulingIntent_customerAccountId_status_idx" ON "SocialSchedulingIntent"("customerAccountId", "status");

CREATE TABLE "SocialPublication" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "schedulingIntentId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "SocialPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "externalPostRef" TEXT,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialPublication_customerAccountId_status_idx" ON "SocialPublication"("customerAccountId", "status");

CREATE TABLE "SocialPublicationEvent" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPublicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialPublicationEvent_publicationId_createdAt_idx" ON "SocialPublicationEvent"("publicationId", "createdAt");

CREATE TABLE "MarketingRequest" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "requestType" "MarketingRequestType" NOT NULL,
    "status" "MarketingRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "brief" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "audience" TEXT,
    "goal" TEXT,
    "sourceRefs" JSONB NOT NULL,
    "artifactIds" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingRequest_customerAccountId_status_idx" ON "MarketingRequest"("customerAccountId", "status");

CREATE TABLE "MarketingArtifact" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "artifactType" "MarketingArtifactType" NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingArtifact_customerAccountId_artifactType_idx" ON "MarketingArtifact"("customerAccountId", "artifactType");

CREATE TABLE "MarketingStudioUsage" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "periodKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingStudioUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingStudioUsage_idempotencyKey_key" ON "MarketingStudioUsage"("idempotencyKey");
CREATE INDEX "MarketingStudioUsage_customerAccountId_periodKey_operation_idx" ON "MarketingStudioUsage"("customerAccountId", "periodKey", "operation");

ALTER TABLE "SocialProviderWorkspaceMapping" ADD CONSTRAINT "SocialProviderWorkspaceMapping_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialProviderWorkspaceMapping" ADD CONSTRAINT "SocialProviderWorkspaceMapping_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialProviderWorkspaceMapping" ADD CONSTRAINT "SocialProviderWorkspaceMapping_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessSocialConnection" ADD CONSTRAINT "BusinessSocialConnection_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessSocialConnection" ADD CONSTRAINT "BusinessSocialConnection_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessSocialConnection" ADD CONSTRAINT "BusinessSocialConnection_workspaceMappingId_fkey" FOREIGN KEY ("workspaceMappingId") REFERENCES "SocialProviderWorkspaceMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialCampaign" ADD CONSTRAINT "SocialCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialCampaignRevision" ADD CONSTRAINT "SocialCampaignRevision_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialCampaignApproval" ADD CONSTRAINT "SocialCampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialCampaignApproval" ADD CONSTRAINT "SocialCampaignApproval_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SocialCampaignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialCampaignApproval" ADD CONSTRAINT "SocialCampaignApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialSchedulingIntent" ADD CONSTRAINT "SocialSchedulingIntent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSchedulingIntent" ADD CONSTRAINT "SocialSchedulingIntent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SocialCampaignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSchedulingIntent" ADD CONSTRAINT "SocialSchedulingIntent_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "SocialCampaignApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialSchedulingIntent" ADD CONSTRAINT "SocialSchedulingIntent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "BusinessSocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SocialCampaignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_schedulingIntentId_fkey" FOREIGN KEY ("schedulingIntentId") REFERENCES "SocialSchedulingIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "BusinessSocialConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialPublicationEvent" ADD CONSTRAINT "SocialPublicationEvent_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "SocialPublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingRequest" ADD CONSTRAINT "MarketingRequest_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingRequest" ADD CONSTRAINT "MarketingRequest_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingRequest" ADD CONSTRAINT "MarketingRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingArtifact" ADD CONSTRAINT "MarketingArtifact_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingArtifact" ADD CONSTRAINT "MarketingArtifact_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingStudioUsage" ADD CONSTRAINT "MarketingStudioUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingStudioUsage" ADD CONSTRAINT "MarketingStudioUsage_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
