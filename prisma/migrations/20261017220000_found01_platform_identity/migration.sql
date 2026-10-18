-- CreateEnum
CREATE TYPE "BillingGroupStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillingGroupMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'UNLINKED');

-- CreateEnum
CREATE TYPE "BillingGroupRoleKind" AS ENUM ('GROUP_OWNER', 'BILLING_ADMIN', 'BILLING_VIEWER');

-- CreateEnum
CREATE TYPE "CreditWalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "WalletLedgerEntryType" AS ENUM ('TOP_UP', 'SETTLE', 'RELEASE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditReservationStatus" AS ENUM ('HELD', 'PARTIALLY_SETTLED', 'SETTLED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MessageUsageStatus" AS ENUM ('QUOTED', 'RESERVED', 'SETTLED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ProviderConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTING', 'VERIFIED', 'DEGRADED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentToolDecision" AS ENUM ('ALLOWED', 'DENIED');

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN "billingGroupId" TEXT;

-- CreateTable
CREATE TABLE "BillingGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "BillingGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "payerContactId" TEXT,
    "billingPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "legalPayerName" TEXT NOT NULL,
    "billingAddressRef" TEXT,
    "taxRef" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultMethodRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSpendingPolicy" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "dailyLimit" INTEGER,
    "monthlyLimit" INTEGER,
    "maxCampaignCredits" INTEGER,
    "allowedChannels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSpendingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingGroupMembership" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "BillingGroupMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "authorizedByUserId" TEXT,
    "walletUseAllowed" BOOLEAN NOT NULL DEFAULT true,
    "spendingPolicyId" TEXT,
    "activeFundingKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingGroupRole" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BillingGroupRoleKind" NOT NULL,
    "capabilityFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingGroupRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "creditType" TEXT NOT NULL DEFAULT 'MESSAGING',
    "unit" TEXT NOT NULL DEFAULT 'CREDITS',
    "status" "CreditWalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "ledgerSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "managedSiteId" TEXT,
    "campaignId" TEXT,
    "orderId" TEXT,
    "type" "WalletLedgerEntryType" NOT NULL,
    "deltaCredits" INTEGER NOT NULL,
    "priceVersion" TEXT NOT NULL,
    "reservationId" TEXT,
    "providerRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReservation" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "originAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "settledAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "CreditReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageUsage" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "walletId" TEXT NOT NULL,
    "reservationId" TEXT,
    "channel" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" "MessageUsageStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "ownerScope" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalAccountRef" TEXT,
    "secretRef" TEXT,
    "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "permissions" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolGrant" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentToolGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolInvocation" (
    "id" TEXT NOT NULL,
    "grantId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "toolKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "correlationId" TEXT,
    "approvalId" TEXT,
    "inputHash" TEXT NOT NULL,
    "decision" "AgentToolDecision" NOT NULL,
    "denialReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingGroup_slug_key" ON "BillingGroup"("slug");

-- CreateIndex
CREATE INDEX "BillingProfile_billingGroupId_idx" ON "BillingProfile"("billingGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSpendingPolicy_billingGroupId_customerAccountId_key" ON "SiteSpendingPolicy"("billingGroupId", "customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingGroupMembership_activeFundingKey_key" ON "BillingGroupMembership"("activeFundingKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingGroupMembership_one_active_funding_per_account" ON "BillingGroupMembership"("customerAccountId") WHERE "status" = 'ACTIVE' AND "walletUseAllowed" = true AND "validTo" IS NULL;

-- CreateIndex
CREATE INDEX "BillingGroupMembership_billingGroupId_status_idx" ON "BillingGroupMembership"("billingGroupId", "status");

-- CreateIndex
CREATE INDEX "BillingGroupMembership_customerAccountId_status_idx" ON "BillingGroupMembership"("customerAccountId", "status");

-- CreateIndex
CREATE INDEX "BillingGroupMembership_billingGroupId_customerAccountId_validFrom_idx" ON "BillingGroupMembership"("billingGroupId", "customerAccountId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "BillingGroupRole_billingGroupId_userId_key" ON "BillingGroupRole"("billingGroupId", "userId");

-- CreateIndex
CREATE INDEX "BillingGroupRole_userId_idx" ON "BillingGroupRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_billingGroupId_creditType_key" ON "CreditWallet"("billingGroupId", "creditType");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_idempotencyKey_key" ON "WalletLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_createdAt_idx" ON "WalletLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_customerAccountId_createdAt_idx" ON "WalletLedgerEntry"("customerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_reservationId_idx" ON "WalletLedgerEntry"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReservation_idempotencyKey_key" ON "CreditReservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditReservation_walletId_status_idx" ON "CreditReservation"("walletId", "status");

-- CreateIndex
CREATE INDEX "CreditReservation_originAccountId_idx" ON "CreditReservation"("originAccountId");

-- CreateIndex
CREATE INDEX "CreditReservation_correlationId_idx" ON "CreditReservation"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageUsage_idempotencyKey_key" ON "MessageUsage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MessageUsage_billingGroupId_createdAt_idx" ON "MessageUsage"("billingGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageUsage_customerAccountId_createdAt_idx" ON "MessageUsage"("customerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageUsage_walletId_createdAt_idx" ON "MessageUsage"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_ownerScope_ownerId_providerKey_key" ON "ProviderConnection"("ownerScope", "ownerId", "providerKey");

-- CreateIndex
CREATE INDEX "ProviderConnection_providerKey_status_idx" ON "ProviderConnection"("providerKey", "status");

-- CreateIndex
CREATE INDEX "AgentToolGrant_customerAccountId_toolKey_idx" ON "AgentToolGrant"("customerAccountId", "toolKey");

-- CreateIndex
CREATE INDEX "AgentToolGrant_actorId_toolKey_idx" ON "AgentToolGrant"("actorId", "toolKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToolInvocation_requestId_toolKey_key" ON "AgentToolInvocation"("requestId", "toolKey");

-- CreateIndex
CREATE INDEX "AgentToolInvocation_customerAccountId_createdAt_idx" ON "AgentToolInvocation"("customerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_billingGroupId_idx" ON "ServiceOrder"("billingGroupId");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSpendingPolicy" ADD CONSTRAINT "SiteSpendingPolicy_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSpendingPolicy" ADD CONSTRAINT "SiteSpendingPolicy_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupMembership" ADD CONSTRAINT "BillingGroupMembership_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupMembership" ADD CONSTRAINT "BillingGroupMembership_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupMembership" ADD CONSTRAINT "BillingGroupMembership_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupMembership" ADD CONSTRAINT "BillingGroupMembership_spendingPolicyId_fkey" FOREIGN KEY ("spendingPolicyId") REFERENCES "SiteSpendingPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupRole" ADD CONSTRAINT "BillingGroupRole_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingGroupRole" ADD CONSTRAINT "BillingGroupRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_originAccountId_fkey" FOREIGN KEY ("originAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsage" ADD CONSTRAINT "MessageUsage_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsage" ADD CONSTRAINT "MessageUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsage" ADD CONSTRAINT "MessageUsage_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsage" ADD CONSTRAINT "MessageUsage_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUsage" ADD CONSTRAINT "MessageUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "CreditReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolGrant" ADD CONSTRAINT "AgentToolGrant_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolGrant" ADD CONSTRAINT "AgentToolGrant_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolInvocation" ADD CONSTRAINT "AgentToolInvocation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolInvocation" ADD CONSTRAINT "AgentToolInvocation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
