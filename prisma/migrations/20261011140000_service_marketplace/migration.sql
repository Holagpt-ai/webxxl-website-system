-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceOrderActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'QUOTE_SET', 'NOTE_ADDED', 'ENTITLEMENT_ACTIVATED');

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "requestedById" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "customerNotes" TEXT,
    "assignedToId" TEXT,
    "internalNotes" TEXT,
    "quoteAmountCents" INTEGER,
    "quoteCurrency" TEXT DEFAULT 'USD',
    "quoteNotes" TEXT,
    "billingProvider" TEXT,
    "billingProviderRef" TEXT,
    "customerServiceId" TEXT,
    "submissionFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderActivity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ServiceOrderActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_publicId_key" ON "ServiceOrder"("publicId");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerAccountId_createdAt_idx" ON "ServiceOrder"("customerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_createdAt_idx" ON "ServiceOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_serviceKey_idx" ON "ServiceOrder"("serviceKey");

-- CreateIndex
CREATE INDEX "ServiceOrder_submissionFingerprint_createdAt_idx" ON "ServiceOrder"("submissionFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrderActivity_orderId_createdAt_idx" ON "ServiceOrderActivity"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderActivity" ADD CONSTRAINT "ServiceOrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderActivity" ADD CONSTRAINT "ServiceOrderActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
