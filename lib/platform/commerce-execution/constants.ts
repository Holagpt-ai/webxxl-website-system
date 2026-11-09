export const COMMERCE_EXECUTION_SOURCE_MODULES = [
  'commerce.catalog_entitlements',
  'commerce.purchase_history',
  'commerce.billing_group_payer',
  'commerce.wallet_instrument_boundary',
  'commerce.payment_provider_readiness',
  'commerce.managed_services_lifecycle',
  'commerce.subscription_state',
  'commerce.invoice_references',
  'commerce.fulfillment_policy',
] as const

export const COMMERCE_EXECUTION_PROVENANCE_NOTICE =
  'Commerce execution summary is readiness and purchase/service state composition only. BillingGroup payer authority covers purchases and invoices; it does not grant sibling CRM, messaging, or campaign access. Shared messaging wallet credits are never used for hosting, domain, subscription, or business-email money purchases. External hosting/domain/email activation requires verified provider evidence — WebXXL service records alone are not ACTIVE provider resources.'

export const COMMERCE_EXECUTION_PLANNING_DISCLOSURE =
  'Catalog amounts and promotional prices are configured per CommerceProductPrice and are not embedded in this summary. Included FREE CRM, Marketing Studio, SEO, and AI capabilities remain SUBSCRIBER_ONLY entitlements and are not newly payable products. Live checkout, charging, provisioning, domain registration, DNS, mailbox creation, and wallet mint stay disabled unless separate owner gates are on.'

export const COMMERCE_EXECUTION_BATCH_VERSION = 'batch5-commerce-managed-services-v1' as const

export const PREPARATION_ONLY_CHECKOUT_BLOCKED_CODE = 'PREPARATION_ONLY_CHECKOUT_BLOCKED'

export const PREPARATION_ONLY_CHECKOUT_BLOCKED_MESSAGE =
  'Commerce execution summary is preparation-only; live checkout and provider charging remain blocked on this route regardless of environment flag values'

export const MANAGED_SERVICE_PRODUCT_KEYS = [
  'website.hosting',
  'domain.registration',
  'email.business',
  'website.subscription',
] as const
