-- CreateEnum
CREATE TYPE "ChatwootMappingVerificationState" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CommsConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "CommsWebhookReceiptStatus" AS ENUM ('RECEIVED', 'QUARANTINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommsWebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "CommunicationIntentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'BLOCKED', 'AWAITING_WALLET', 'READY', 'DISPATCHING', 'ACCEPTED_BY_PROVIDER', 'DELIVERED', 'FAILED', 'RECONCILIATION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationDispatchStatus" AS ENUM ('PREPARED', 'BLOCKED', 'AWAITING_WALLET', 'DISPATCHING', 'ACCEPTED_BY_PROVIDER', 'DELIVERED', 'FAILED', 'RECONCILIATION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommsDataClassification" AS ENUM ('GENERAL_BUSINESS', 'REGULATED_HEALTHCARE', 'CREDENTIAL', 'BILLING', 'SECURITY_AUDIT');

-- CreateTable
CREATE TABLE "ChatwootTenantMapping" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "providerInstanceId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "authorizedInboxIds" JSONB NOT NULL,
    "credentialSecretRef" TEXT,
    "verificationState" "ChatwootMappingVerificationState" NOT NULL DEFAULT 'PENDING',
    "provisioningSource" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "auditMetadata" JSONB,
    "webhookSecretRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatwootTenantMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatwootInboxMapping" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "tenantMappingId" TEXT NOT NULL,
    "externalInboxId" TEXT NOT NULL,
    "channelType" TEXT,
    "verificationState" "ChatwootMappingVerificationState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatwootInboxMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatwootConversationMapping" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "tenantMappingId" TEXT NOT NULL,
    "externalConversationId" TEXT NOT NULL,
    "externalInboxId" TEXT NOT NULL,
    "crmContactId" TEXT,
    "channel" TEXT NOT NULL,
    "webxxlStatus" "CommsConversationStatus" NOT NULL DEFAULT 'OPEN',
    "assignedUserRef" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "lastActivityAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "coverageState" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "syncError" TEXT,
    "handoffAudit" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatwootConversationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatwootSyncCursor" (
    "id" TEXT NOT NULL,
    "tenantMappingId" TEXT NOT NULL,
    "cursorKey" TEXT NOT NULL,
    "cursorValue" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatwootSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommsWebhookReceipt" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerInstanceId" TEXT,
    "customerAccountId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "receiptStatus" "CommsWebhookReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "processingStatus" "CommsWebhookProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "quarantineReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "sanitizedDetail" JSONB,

    CONSTRAINT "CommsWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReconciliationCandidate" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "externalContactRef" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactReconciliationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingTenant" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "legalBusinessName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderIdentity" (
    "id" TEXT NOT NULL,
    "messagingTenantId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "channel" "CrmConsentChannel" NOT NULL,
    "purpose" "CrmConsentPurpose" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerSubaccountRef" TEXT,
    "senderRef" TEXT NOT NULL,
    "registrationStatus" TEXT NOT NULL DEFAULT 'NOT_REGISTERED',
    "verificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "complianceProfileKey" TEXT,
    "dataClassification" "CommsDataClassification" NOT NULL DEFAULT 'GENERAL_BUSINESS',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationQuote" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "channel" "CrmConsentChannel" NOT NULL,
    "purpose" "CrmConsentPurpose" NOT NULL,
    "senderIdentityId" TEXT,
    "recipientCount" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "suppressedCount" INTEGER NOT NULL,
    "unknownConsentCount" INTEGER NOT NULL,
    "estimatedUnits" INTEGER NOT NULL,
    "unitCostSource" TEXT,
    "unitCostVersion" TEXT,
    "policyDecision" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationIntent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "quoteId" TEXT,
    "channel" "CrmConsentChannel" NOT NULL,
    "purpose" "CrmConsentPurpose" NOT NULL,
    "senderIdentityId" TEXT,
    "status" "CommunicationIntentStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL,
    "policyDecision" TEXT NOT NULL,
    "dataClassification" "CommsDataClassification" NOT NULL DEFAULT 'GENERAL_BUSINESS',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "crmContactId" TEXT,
    "normalizedAddress" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationApproval" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "approverUserId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDispatchAttempt" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "CommunicationDispatchStatus" NOT NULL DEFAULT 'PREPARED',
    "providerKey" TEXT,
    "providerMessageRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationDispatchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationProviderEvent" (
    "id" TEXT NOT NULL,
    "intentId" TEXT,
    "customerAccountId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAuditEvent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "operation" TEXT NOT NULL,
    "resourceRef" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootTenantMapping_providerInstanceId_externalAccountId_key" ON "ChatwootTenantMapping"("providerInstanceId", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootTenantMapping_customerAccountId_providerInstanceId_key" ON "ChatwootTenantMapping"("customerAccountId", "providerInstanceId");

-- CreateIndex
CREATE INDEX "ChatwootTenantMapping_customerAccountId_verificationState_idx" ON "ChatwootTenantMapping"("customerAccountId", "verificationState");

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootInboxMapping_tenantMappingId_externalInboxId_key" ON "ChatwootInboxMapping"("tenantMappingId", "externalInboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootInboxMapping_customerAccountId_externalInboxId_key" ON "ChatwootInboxMapping"("customerAccountId", "externalInboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootConversationMapping_customerAccountId_externalConvers_key" ON "ChatwootConversationMapping"("customerAccountId", "externalConversationId");

-- CreateIndex
CREATE INDEX "ChatwootConversationMapping_customerAccountId_webxxlStatus_las_idx" ON "ChatwootConversationMapping"("customerAccountId", "webxxlStatus", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatwootSyncCursor_tenantMappingId_cursorKey_key" ON "ChatwootSyncCursor"("tenantMappingId", "cursorKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommsWebhookReceipt_idempotencyKey_key" ON "CommsWebhookReceipt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommsWebhookReceipt_providerKey_externalEventId_key" ON "CommsWebhookReceipt"("providerKey", "externalEventId");

-- CreateIndex
CREATE INDEX "CommsWebhookReceipt_customerAccountId_receivedAt_idx" ON "CommsWebhookReceipt"("customerAccountId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactReconciliationCandidate_customerAccountId_sourceSystem_key" ON "ContactReconciliationCandidate"("customerAccountId", "sourceSystem", "externalContactRef");

-- CreateIndex
CREATE INDEX "ContactReconciliationCandidate_customerAccountId_status_idx" ON "ContactReconciliationCandidate"("customerAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingTenant_customerAccountId_key" ON "MessagingTenant"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SenderIdentity_customerAccountId_channel_senderRef_key" ON "SenderIdentity"("customerAccountId", "channel", "senderRef");

-- CreateIndex
CREATE INDEX "CommunicationQuote_customerAccountId_createdAt_idx" ON "CommunicationQuote"("customerAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationIntent_idempotencyKey_key" ON "CommunicationIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommunicationIntent_customerAccountId_status_idx" ON "CommunicationIntent"("customerAccountId", "status");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_intentId_idx" ON "CommunicationRecipient"("intentId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_customerAccountId_normalizedAddress_idx" ON "CommunicationRecipient"("customerAccountId", "normalizedAddress");

-- CreateIndex
CREATE INDEX "CommunicationApproval_intentId_idx" ON "CommunicationApproval"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationDispatchAttempt_idempotencyKey_key" ON "CommunicationDispatchAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommunicationDispatchAttempt_customerAccountId_status_idx" ON "CommunicationDispatchAttempt"("customerAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProviderEvent_idempotencyKey_key" ON "CommunicationProviderEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProviderEvent_providerKey_externalEventId_key" ON "CommunicationProviderEvent"("providerKey", "externalEventId");

-- CreateIndex
CREATE INDEX "CommunicationAuditEvent_customerAccountId_operation_createdAt_idx" ON "CommunicationAuditEvent"("customerAccountId", "operation", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatwootTenantMapping" ADD CONSTRAINT "ChatwootTenantMapping_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootTenantMapping" ADD CONSTRAINT "ChatwootTenantMapping_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootInboxMapping" ADD CONSTRAINT "ChatwootInboxMapping_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootInboxMapping" ADD CONSTRAINT "ChatwootInboxMapping_tenantMappingId_fkey" FOREIGN KEY ("tenantMappingId") REFERENCES "ChatwootTenantMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootConversationMapping" ADD CONSTRAINT "ChatwootConversationMapping_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootConversationMapping" ADD CONSTRAINT "ChatwootConversationMapping_tenantMappingId_fkey" FOREIGN KEY ("tenantMappingId") REFERENCES "ChatwootTenantMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootConversationMapping" ADD CONSTRAINT "ChatwootConversationMapping_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatwootSyncCursor" ADD CONSTRAINT "ChatwootSyncCursor_tenantMappingId_fkey" FOREIGN KEY ("tenantMappingId") REFERENCES "ChatwootTenantMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommsWebhookReceipt" ADD CONSTRAINT "CommsWebhookReceipt_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactReconciliationCandidate" ADD CONSTRAINT "ContactReconciliationCandidate_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingTenant" ADD CONSTRAINT "MessagingTenant_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingTenant" ADD CONSTRAINT "MessagingTenant_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_messagingTenantId_fkey" FOREIGN KEY ("messagingTenantId") REFERENCES "MessagingTenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SenderIdentity" ADD CONSTRAINT "SenderIdentity_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationQuote" ADD CONSTRAINT "CommunicationQuote_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationIntent" ADD CONSTRAINT "CommunicationIntent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationApproval" ADD CONSTRAINT "CommunicationApproval_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDispatchAttempt" ADD CONSTRAINT "CommunicationDispatchAttempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationProviderEvent" ADD CONSTRAINT "CommunicationProviderEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "CommunicationIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAuditEvent" ADD CONSTRAINT "CommunicationAuditEvent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
