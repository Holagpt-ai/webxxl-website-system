-- Batch 25: customer dependency navigation and explicit acknowledgment

ALTER TABLE "ProjectDependency" ADD COLUMN "customerActionKey" TEXT;
ALTER TABLE "ProjectDependency" ADD COLUMN "allowsCustomerAck" BOOLEAN NOT NULL DEFAULT false;
