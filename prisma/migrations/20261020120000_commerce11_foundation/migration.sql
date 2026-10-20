-- COMMERCE-11 provider-neutral catalog, checkout, payments, subscriptions, and fulfillment.
-- Not applied to production by this change.

ALTER TABLE "WalletFundingEvidence" ADD COLUMN "commerceOrderId" TEXT;
ALTER TABLE "WalletFundingEvidence" ADD COLUMN "commercePaymentId" TEXT;
ALTER TABLE "WalletFundingEvidence" ADD COLUMN "priceVersion" TEXT;

CREATE TYPE "CommerceProductKind" AS ENUM ('WEBSITE_PACKAGE', 'HOSTING', 'DOMAIN', 'CRM', 'MARKETING', 'SEO', 'AI_WORKFORCE', 'MESSAGING_CREDITS', 'SUBSCRIPTION', 'ADDON');
CREATE TYPE "CommercePricingMode" AS ENUM ('INCLUDED_FREE', 'RECURRING', 'ONE_TIME', 'METERED_EXTERNAL');
CREATE TYPE "CommerceBillingInterval" AS ENUM ('NONE', 'MONTH', 'YEAR');
CREATE TYPE "CommerceActivationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "CommerceOrderStatus" AS ENUM ('PENDING', 'CHECKOUT_CREATED', 'PAYMENT_PENDING', 'PAID', 'FULFILLMENT_PENDING', 'FULFILLED', 'FULFILLMENT_BLOCKED', 'CANCELLED', 'REFUNDED', 'FAILED');
CREATE TYPE "CommerceCheckoutStatus" AS ENUM ('CREATED', 'READY', 'DISABLED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "CommercePaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');
CREATE TYPE "CommerceSubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCEL_SCHEDULED', 'CANCELLED', 'PAUSED');
CREATE TYPE "CommerceFulfillmentStatus" AS ENUM ('NOT_STARTED', 'PREPARED', 'BLOCKED', 'COMPLETED', 'FAILED');
CREATE TYPE "CommerceWebhookStatus" AS ENUM ('RECEIVED', 'DUPLICATE', 'OUT_OF_ORDER', 'PROCESSED', 'FAILED', 'IGNORED');

CREATE TABLE "CommerceProduct" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "kind" "CommerceProductKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CommerceActivationStatus" NOT NULL DEFAULT 'DRAFT',
    "pricingMode" "CommercePricingMode" NOT NULL,
    "entitlementKey" TEXT,
    "creditEligible" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityCohort" TEXT NOT NULL DEFAULT 'SUBSCRIBER_ONLY',
    "featureFlag" TEXT,
    "purchasable" BOOLEAN NOT NULL DEFAULT false,
    "providerPassThrough" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceProductPrice" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "billingInterval" "CommerceBillingInterval" NOT NULL DEFAULT 'NONE',
    "status" "CommerceActivationStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "priceVersion" TEXT NOT NULL,
    "creditAmount" INTEGER,
    "includedUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceProviderPriceMap" (
    "id" TEXT NOT NULL,
    "productPriceId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalPriceRef" TEXT,
    "status" "CommerceActivationStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceProviderPriceMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "projectId" TEXT,
    "payerUserId" TEXT,
    "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productPriceId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "priceVersion" TEXT NOT NULL,
    "creditAmount" INTEGER,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceCheckoutIntent" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "status" "CommerceCheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "externalCheckoutRef" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceCheckoutIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercePayment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "providerKey" TEXT NOT NULL,
    "externalPaymentRef" TEXT,
    "status" "CommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "lastEventSequence" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercePaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "CommercePaymentStatus" NOT NULL,
    "providerEventId" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercePaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceSubscription" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "projectId" TEXT,
    "productId" TEXT NOT NULL,
    "productPriceId" TEXT NOT NULL,
    "orderId" TEXT,
    "providerKey" TEXT NOT NULL,
    "externalSubscriptionRef" TEXT,
    "status" "CommerceSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "billingInterval" "CommerceBillingInterval" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "renewalMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceInvoiceReference" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "billingGroupId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "providerKey" TEXT NOT NULL,
    "externalInvoiceRef" TEXT,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceInvoiceReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectService" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "commerceOrderId" TEXT,
    "serviceOrderId" TEXT,
    "productKey" TEXT NOT NULL,
    "status" "CommerceFulfillmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "entitlementKey" TEXT,
    "customerServiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processingStatus" "CommerceWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "sequenceHint" INTEGER,
    "orderId" TEXT,
    "paymentId" TEXT,
    "failureCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "CommerceWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "CommerceFulfillmentStatus" NOT NULL DEFAULT 'PREPARED',
    "idempotencyKey" TEXT NOT NULL,
    "externalPaymentRef" TEXT,
    "walletFundingEvidenceId" TEXT,
    "ledgerEntryId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceAuditEvent" (
    "id" TEXT NOT NULL,
    "billingGroupId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceProduct_publicId_key" ON "CommerceProduct"("publicId");
CREATE UNIQUE INDEX "CommerceProduct_productKey_key" ON "CommerceProduct"("productKey");
CREATE INDEX "CommerceProduct_status_kind_idx" ON "CommerceProduct"("status", "kind");
CREATE UNIQUE INDEX "CommerceProductPrice_publicId_key" ON "CommerceProductPrice"("publicId");
CREATE UNIQUE INDEX "CommerceProductPrice_productId_priceVersion_currency_key" ON "CommerceProductPrice"("productId", "priceVersion", "currency");
CREATE INDEX "CommerceProductPrice_productId_status_effectiveFrom_idx" ON "CommerceProductPrice"("productId", "status", "effectiveFrom");
CREATE UNIQUE INDEX "CommerceProviderPriceMap_productPriceId_providerKey_key" ON "CommerceProviderPriceMap"("productPriceId", "providerKey");
CREATE UNIQUE INDEX "CommerceOrder_publicId_key" ON "CommerceOrder"("publicId");
CREATE UNIQUE INDEX "CommerceOrder_idempotencyKey_key" ON "CommerceOrder"("idempotencyKey");
CREATE UNIQUE INDEX "CommerceOrder_serviceOrderId_key" ON "CommerceOrder"("serviceOrderId");
CREATE INDEX "CommerceOrder_billingGroupId_createdAt_idx" ON "CommerceOrder"("billingGroupId", "createdAt");
CREATE INDEX "CommerceOrder_customerAccountId_createdAt_idx" ON "CommerceOrder"("customerAccountId", "createdAt");
CREATE INDEX "CommerceOrder_status_createdAt_idx" ON "CommerceOrder"("status", "createdAt");
CREATE INDEX "CommerceOrderItem_orderId_idx" ON "CommerceOrderItem"("orderId");
CREATE INDEX "CommerceOrderItem_productId_idx" ON "CommerceOrderItem"("productId");
CREATE UNIQUE INDEX "CommerceCheckoutIntent_publicId_key" ON "CommerceCheckoutIntent"("publicId");
CREATE UNIQUE INDEX "CommerceCheckoutIntent_idempotencyKey_key" ON "CommerceCheckoutIntent"("idempotencyKey");
CREATE UNIQUE INDEX "CommerceCheckoutIntent_providerKey_externalCheckoutRef_key" ON "CommerceCheckoutIntent"("providerKey", "externalCheckoutRef");
CREATE INDEX "CommerceCheckoutIntent_orderId_createdAt_idx" ON "CommerceCheckoutIntent"("orderId", "createdAt");
CREATE UNIQUE INDEX "CommercePayment_publicId_key" ON "CommercePayment"("publicId");
CREATE UNIQUE INDEX "CommercePayment_idempotencyKey_key" ON "CommercePayment"("idempotencyKey");
CREATE UNIQUE INDEX "CommercePayment_providerKey_externalPaymentRef_key" ON "CommercePayment"("providerKey", "externalPaymentRef");
CREATE INDEX "CommercePayment_orderId_idx" ON "CommercePayment"("orderId");
CREATE INDEX "CommercePayment_billingGroupId_createdAt_idx" ON "CommercePayment"("billingGroupId", "createdAt");
CREATE UNIQUE INDEX "CommercePaymentAttempt_paymentId_attemptNumber_key" ON "CommercePaymentAttempt"("paymentId", "attemptNumber");
CREATE INDEX "CommercePaymentAttempt_providerEventId_idx" ON "CommercePaymentAttempt"("providerEventId");
CREATE UNIQUE INDEX "CommerceSubscription_publicId_key" ON "CommerceSubscription"("publicId");
CREATE UNIQUE INDEX "CommerceSubscription_providerKey_externalSubscriptionRef_key" ON "CommerceSubscription"("providerKey", "externalSubscriptionRef");
CREATE INDEX "CommerceSubscription_billingGroupId_status_idx" ON "CommerceSubscription"("billingGroupId", "status");
CREATE INDEX "CommerceSubscription_customerAccountId_idx" ON "CommerceSubscription"("customerAccountId");
CREATE UNIQUE INDEX "CommerceInvoiceReference_publicId_key" ON "CommerceInvoiceReference"("publicId");
CREATE UNIQUE INDEX "CommerceInvoiceReference_providerKey_externalInvoiceRef_key" ON "CommerceInvoiceReference"("providerKey", "externalInvoiceRef");
CREATE INDEX "CommerceInvoiceReference_billingGroupId_createdAt_idx" ON "CommerceInvoiceReference"("billingGroupId", "createdAt");
CREATE INDEX "CommerceInvoiceReference_customerAccountId_createdAt_idx" ON "CommerceInvoiceReference"("customerAccountId", "createdAt");
CREATE INDEX "CommerceInvoiceReference_orderId_idx" ON "CommerceInvoiceReference"("orderId");
CREATE INDEX "ProjectService_projectId_idx" ON "ProjectService"("projectId");
CREATE INDEX "ProjectService_customerAccountId_createdAt_idx" ON "ProjectService"("customerAccountId", "createdAt");
CREATE INDEX "ProjectService_commerceOrderId_idx" ON "ProjectService"("commerceOrderId");
CREATE UNIQUE INDEX "CommerceWebhookEvent_providerKey_externalEventId_key" ON "CommerceWebhookEvent"("providerKey", "externalEventId");
CREATE INDEX "CommerceWebhookEvent_orderId_receivedAt_idx" ON "CommerceWebhookEvent"("orderId", "receivedAt");
CREATE INDEX "CommerceWebhookEvent_paymentId_idx" ON "CommerceWebhookEvent"("paymentId");
CREATE UNIQUE INDEX "CommerceFulfillment_orderId_key" ON "CommerceFulfillment"("orderId");
CREATE UNIQUE INDEX "CommerceFulfillment_idempotencyKey_key" ON "CommerceFulfillment"("idempotencyKey");
CREATE UNIQUE INDEX "CommerceFulfillment_externalPaymentRef_key" ON "CommerceFulfillment"("externalPaymentRef");
CREATE INDEX "CommerceAuditEvent_entityType_entityId_createdAt_idx" ON "CommerceAuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "CommerceAuditEvent_billingGroupId_createdAt_idx" ON "CommerceAuditEvent"("billingGroupId", "createdAt");

ALTER TABLE "CommerceProductPrice" ADD CONSTRAINT "CommerceProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceProviderPriceMap" ADD CONSTRAINT "CommerceProviderPriceMap_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES "CommerceProductPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES "CommerceProductPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceCheckoutIntent" ADD CONSTRAINT "CommerceCheckoutIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommercePaymentAttempt" ADD CONSTRAINT "CommercePaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_productPriceId_fkey" FOREIGN KEY ("productPriceId") REFERENCES "CommerceProductPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceSubscription" ADD CONSTRAINT "CommerceSubscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceInvoiceReference" ADD CONSTRAINT "CommerceInvoiceReference_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceInvoiceReference" ADD CONSTRAINT "CommerceInvoiceReference_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceInvoiceReference" ADD CONSTRAINT "CommerceInvoiceReference_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceInvoiceReference" ADD CONSTRAINT "CommerceInvoiceReference_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CommerceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_commerceOrderId_fkey" FOREIGN KEY ("commerceOrderId") REFERENCES "CommerceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_customerServiceId_fkey" FOREIGN KEY ("customerServiceId") REFERENCES "CustomerService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceWebhookEvent" ADD CONSTRAINT "CommerceWebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceWebhookEvent" ADD CONSTRAINT "CommerceWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceFulfillment" ADD CONSTRAINT "CommerceFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceAuditEvent" ADD CONSTRAINT "CommerceAuditEvent_billingGroupId_fkey" FOREIGN KEY ("billingGroupId") REFERENCES "BillingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
