-- CreateEnum
CREATE TYPE "AutomationEventType" AS ENUM ('PROJECT_CREATED', 'MILESTONE_COMPLETED', 'APPROVAL_REQUESTED', 'CUSTOMER_APPROVAL_SUBMITTED', 'CUSTOMER_MESSAGE_RECEIVED', 'CHANGE_REQUEST_SUBMITTED', 'LEAD_RECEIVED', 'LEAD_ASSIGNED', 'LEAD_FOLLOW_UP_DUE', 'LEAD_CONVERTED', 'SERVICE_ORDER_REQUESTED', 'SERVICE_ORDER_QUOTE_READY', 'SERVICE_ORDER_STATUS_UPDATED', 'SERVICE_ACTIVATED', 'DOMAIN_RENEWAL_APPROACHING', 'HOSTING_RENEWAL_APPROACHING', 'EMAIL_SERVICE_RENEWAL_APPROACHING', 'INFRASTRUCTURE_SUPPORT_REQUEST_SUBMITTED');

-- CreateEnum
CREATE TYPE "AutomationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "AutomationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "CustomerNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "projectUpdates" BOOLEAN NOT NULL DEFAULT true,
    "messagesAndApprovals" BOOLEAN NOT NULL DEFAULT true,
    "serviceOrders" BOOLEAN NOT NULL DEFAULT true,
    "infrastructureRenewals" BOOLEAN NOT NULL DEFAULT true,
    "transactionalEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" "AutomationEventType" NOT NULL,
    "customerAccountId" TEXT,
    "actorUserId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationDeliveryJob" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" "AutomationDeliveryChannel" NOT NULL,
    "status" "AutomationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorClass" TEXT,
    "providerRef" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationDeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureRenewalReminder" (
    "id" TEXT NOT NULL,
    "assetType" "InfrastructureAssetType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureRenewalReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerNotificationPreference_userId_customerAccountId_key" ON "CustomerNotificationPreference"("userId", "customerAccountId");

-- CreateIndex
CREATE INDEX "CustomerNotificationPreference_customerAccountId_idx" ON "CustomerNotificationPreference"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_dedupeKey_key" ON "AutomationEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "AutomationEvent_customerAccountId_createdAt_idx" ON "AutomationEvent"("customerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationEvent_eventType_createdAt_idx" ON "AutomationEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationDeliveryJob_dedupeKey_key" ON "AutomationDeliveryJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "AutomationDeliveryJob_status_nextAttemptAt_idx" ON "AutomationDeliveryJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AutomationDeliveryJob_eventId_idx" ON "AutomationDeliveryJob"("eventId");

-- CreateIndex
CREATE INDEX "AutomationDeliveryJob_recipientUserId_idx" ON "AutomationDeliveryJob"("recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureRenewalReminder_assetType_assetId_windowDays_key" ON "InfrastructureRenewalReminder"("assetType", "assetId", "windowDays");

-- CreateIndex
CREATE INDEX "InfrastructureRenewalReminder_assetType_assetId_idx" ON "InfrastructureRenewalReminder"("assetType", "assetId");

-- AddForeignKey
ALTER TABLE "CustomerNotificationPreference" ADD CONSTRAINT "CustomerNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNotificationPreference" ADD CONSTRAINT "CustomerNotificationPreference_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationDeliveryJob" ADD CONSTRAINT "AutomationDeliveryJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AutomationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationDeliveryJob" ADD CONSTRAINT "AutomationDeliveryJob_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
