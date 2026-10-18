-- WALLET-09: shared credit wallet extensions, rate plans, top-up quotes, provider reconciliation receipts

-- AlterTable SiteSpendingPolicy
ALTER TABLE "SiteSpendingPolicy" ADD COLUMN "managedSiteId" TEXT;
ALTER TABLE "SiteSpendingPolicy" ADD COLUMN "managedSiteDailyLimit" INTEGER;
ALTER TABLE "SiteSpendingPolicy" ADD COLUMN "groupHardCap" INTEGER;
ALTER TABLE "SiteSpendingPolicy" ADD COLUMN "policyTimezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable WalletLedgerEntry
ALTER TABLE "WalletLedgerEntry" ADD COLUMN "originalLedgerEntryId" TEXT;
ALTER TABLE "WalletLedgerEntry" ADD COLUMN "refundReason" TEXT;

-- AlterTable CreditReservation
ALTER TABLE "CreditReservation" ADD COLUMN "managedSiteId" TEXT;
ALTER TABLE "CreditReservation" ADD COLUMN "channel" TEXT;
ALTER TABLE "CreditReservation" ADD COLUMN "usagePurpose" TEXT;
ALTER TABLE "CreditReservation" ADD COLUMN "rateVersion" TEXT;
ALTER TABLE "CreditReservation" ADD COLUMN "requestFingerprint" TEXT;

-- AlterTable CommunicationQuote
ALTER TABLE "CommunicationQuote" ADD COLUMN "billingGroupId" TEXT;
ALTER TABLE "CommunicationQuote" ADD COLUMN "maxApprovedCredits" INTEGER;
ALTER TABLE "CommunicationQuote" ADD COLUMN "ratePlanVersion" TEXT;
ALTER TABLE "CommunicationQuote" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "CommunicationQuote" ADD COLUMN "policyVersion" TEXT;

-- CreateEnum
CREATE TYPE "WalletTopUpQuoteStatus" AS ENUM ('DRAFT', 'EXPIRED', 'CHECKOUT_PREPARED', 'ABANDONED');

-- CreateTable MessagingRatePlan
CREATE TABLE "MessagingRatePlan" (
    "id" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessagingRatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable MessagingRateVersion
CREATE TABLE "MessagingRateVersion" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL,
    "creditsPerUnit" INTEGER NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "maxSegmentUnits" INTEGER,
    "calculationNotes" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "priceSource" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagingRateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable WalletTopUpQuote
CREATE TABLE "WalletTopUpQuote" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "fiatMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceVersion" TEXT NOT NULL,
    "providerKey" TEXT,
    "status" "WalletTopUpQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTopUpQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable WalletProviderEventReceipt
CREATE TABLE "WalletProviderEventReceipt" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "walletId" TEXT,
    "reservationId" TEXT,
    "ledgerEntryId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "normalizedStatus" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletProviderEventReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable WalletFundingEvidence
CREATE TABLE "WalletFundingEvidence" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "topUpQuoteId" TEXT,
    "providerKey" TEXT NOT NULL,
    "externalPaymentRef" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "ledgerEntryId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletFundingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingRatePlan_planKey_key" ON "MessagingRatePlan"("planKey");
CREATE UNIQUE INDEX "MessagingRateVersion_ratePlanId_versionKey_key" ON "MessagingRateVersion"("ratePlanId", "versionKey");
CREATE INDEX "MessagingRateVersion_ratePlanId_validFrom_idx" ON "MessagingRateVersion"("ratePlanId", "validFrom");
CREATE UNIQUE INDEX "WalletTopUpQuote_idempotencyKey_key" ON "WalletTopUpQuote"("idempotencyKey");
CREATE INDEX "WalletTopUpQuote_billingGroupId_createdAt_idx" ON "WalletTopUpQuote"("billingGroupId", "createdAt");
CREATE UNIQUE INDEX "WalletProviderEventReceipt_providerKey_externalEventId_key" ON "WalletProviderEventReceipt"("providerKey", "externalEventId");
CREATE INDEX "WalletProviderEventReceipt_reservationId_idx" ON "WalletProviderEventReceipt"("reservationId");
CREATE INDEX "WalletProviderEventReceipt_walletId_processedAt_idx" ON "WalletProviderEventReceipt"("walletId", "processedAt");
CREATE UNIQUE INDEX "WalletFundingEvidence_externalPaymentRef_key" ON "WalletFundingEvidence"("externalPaymentRef");
CREATE INDEX "WalletFundingEvidence_billingGroupId_createdAt_idx" ON "WalletFundingEvidence"("billingGroupId", "createdAt");
CREATE INDEX "SiteSpendingPolicy_managedSiteId_idx" ON "SiteSpendingPolicy"("managedSiteId");
CREATE INDEX "WalletLedgerEntry_originalLedgerEntryId_idx" ON "WalletLedgerEntry"("originalLedgerEntryId");
CREATE UNIQUE INDEX "CreditReservation_walletId_requestFingerprint_key" ON "CreditReservation"("walletId", "requestFingerprint");
CREATE INDEX "CommunicationQuote_billingGroupId_createdAt_idx" ON "CommunicationQuote"("billingGroupId", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteSpendingPolicy" ADD CONSTRAINT "SiteSpendingPolicy_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_originalLedgerEntryId_fkey" FOREIGN KEY ("originalLedgerEntryId") REFERENCES "WalletLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingRateVersion" ADD CONSTRAINT "MessagingRateVersion_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "MessagingRatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTopUpQuote" ADD CONSTRAINT "WalletTopUpQuote_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletProviderEventReceipt" ADD CONSTRAINT "WalletProviderEventReceipt_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletProviderEventReceipt" ADD CONSTRAINT "WalletProviderEventReceipt_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "CreditReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletFundingEvidence" ADD CONSTRAINT "WalletFundingEvidence_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletFundingEvidence" ADD CONSTRAINT "WalletFundingEvidence_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
