-- AlterEnum
ALTER TYPE "CommsWebhookProcessingStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "CommsWebhookReceipt" ADD COLUMN     "tenantMappingId" TEXT,
ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "eventDedupeKey" TEXT,
ADD COLUMN     "relayTimestampSeconds" INTEGER,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CommsWebhookReceipt_eventDedupeKey_key" ON "CommsWebhookReceipt"("eventDedupeKey");

-- CreateIndex
CREATE INDEX "CommsWebhookReceipt_providerKey_providerInstanceId_externalA_idx" ON "CommsWebhookReceipt"("providerKey", "providerInstanceId", "externalAccountId", "eventType");

-- DropIndex
DROP INDEX "CommsWebhookReceipt_providerKey_externalEventId_key";
