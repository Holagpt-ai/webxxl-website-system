-- CreateEnum
CREATE TYPE "InfrastructureDataSource" AS ENUM ('MANUAL', 'PROVIDER_VERIFIED');

-- CreateEnum
CREATE TYPE "InfrastructureManagementMode" AS ENUM ('MANUAL', 'PROVIDER_READONLY', 'PROVIDER_SYNC_READY');

-- CreateEnum
CREATE TYPE "HostingServiceStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HostingSslStatus" AS ENUM ('UNKNOWN', 'NOT_APPLICABLE', 'PENDING', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DomainRenewalStatus" AS ENUM ('UNKNOWN', 'AUTO', 'MANUAL', 'PENDING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "BusinessEmailServiceStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InfrastructureAssetType" AS ENUM ('HOSTING', 'DOMAIN', 'EMAIL');

-- CreateTable
CREATE TABLE "HostingService" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "providerId" TEXT NOT NULL,
    "externalProviderRef" TEXT,
    "planLabel" TEXT,
    "primaryDomain" TEXT,
    "managedDomainId" TEXT,
    "status" "HostingServiceStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),
    "sslStatus" "HostingSslStatus" NOT NULL DEFAULT 'UNKNOWN',
    "managementMode" "InfrastructureManagementMode" NOT NULL DEFAULT 'MANUAL',
    "dataSource" "InfrastructureDataSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "internalNotes" TEXT,
    "metadata" JSONB,
    "syncRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedDomain" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "registrar" TEXT,
    "registeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "renewalStatus" "DomainRenewalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "nameservers" JSONB,
    "dnsProviderId" TEXT,
    "verificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "dataSource" "InfrastructureDataSource" NOT NULL DEFAULT 'MANUAL',
    "providerReference" TEXT,
    "internalNotes" TEXT,
    "metadata" JSONB,
    "syncRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEmailService" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedDomainId" TEXT,
    "providerId" TEXT NOT NULL,
    "planLabel" TEXT,
    "mailboxCount" INTEGER NOT NULL DEFAULT 0,
    "renewsAt" TIMESTAMP(3),
    "status" "BusinessEmailServiceStatus" NOT NULL DEFAULT 'PENDING',
    "externalProviderRef" TEXT,
    "dataSource" "InfrastructureDataSource" NOT NULL DEFAULT 'MANUAL',
    "internalNotes" TEXT,
    "metadata" JSONB,
    "syncRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEmailService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureActivity" (
    "id" TEXT NOT NULL,
    "assetType" "InfrastructureAssetType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfrastructureActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostingService_publicId_key" ON "HostingService"("publicId");

-- CreateIndex
CREATE INDEX "HostingService_customerAccountId_idx" ON "HostingService"("customerAccountId");

-- CreateIndex
CREATE INDEX "HostingService_projectId_idx" ON "HostingService"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedDomain_publicId_key" ON "ManagedDomain"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedDomain_customerAccountId_domainName_key" ON "ManagedDomain"("customerAccountId", "domainName");

-- CreateIndex
CREATE INDEX "ManagedDomain_customerAccountId_idx" ON "ManagedDomain"("customerAccountId");

-- CreateIndex
CREATE INDEX "ManagedDomain_expiresAt_idx" ON "ManagedDomain"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessEmailService_publicId_key" ON "BusinessEmailService"("publicId");

-- CreateIndex
CREATE INDEX "BusinessEmailService_customerAccountId_idx" ON "BusinessEmailService"("customerAccountId");

-- CreateIndex
CREATE INDEX "BusinessEmailService_managedDomainId_idx" ON "BusinessEmailService"("managedDomainId");

-- CreateIndex
CREATE INDEX "InfrastructureActivity_assetType_assetId_createdAt_idx" ON "InfrastructureActivity"("assetType", "assetId", "createdAt");

-- CreateIndex
CREATE INDEX "InfrastructureActivity_customerAccountId_createdAt_idx" ON "InfrastructureActivity"("customerAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "HostingService" ADD CONSTRAINT "HostingService_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingService" ADD CONSTRAINT "HostingService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingService" ADD CONSTRAINT "HostingService_managedDomainId_fkey" FOREIGN KEY ("managedDomainId") REFERENCES "ManagedDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedDomain" ADD CONSTRAINT "ManagedDomain_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEmailService" ADD CONSTRAINT "BusinessEmailService_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessEmailService" ADD CONSTRAINT "BusinessEmailService_managedDomainId_fkey" FOREIGN KEY ("managedDomainId") REFERENCES "ManagedDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureActivity" ADD CONSTRAINT "InfrastructureActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
