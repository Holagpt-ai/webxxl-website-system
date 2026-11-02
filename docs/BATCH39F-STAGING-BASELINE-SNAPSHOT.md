# BATCH39F — Staging baseline snapshot (sanitized)

**Captured:** 2026-11-02T22:17:20.452Z · **Identity:** `supabase:vcgibefnhneaqhcguhnt/postgres`

## Schemas (non-system)

- `auth`
- `extensions`
- `graphql`
- `graphql_public`
- `public`
- `realtime`
- `storage`
- `vault`

## Public application objects (pre-reset)

| Metric | Count |
|---|---:|
| Public tables | 71 |
| Public enum types | 66 |
| `_prisma_migrations` rows | 22 |
| CustomerAccount rows | 0 |
| User rows | 0 |
| Crm* / ContactConsent tables | 0 |

## Migration history (names only)

- `20251008120000_customer_portal_core` finished=no rolled_back=yes
- `20251008120000_customer_portal_core` finished=yes rolled_back=no
- `20261010180000_project_file_links` finished=yes rolled_back=no
- `20261010200000_managed_sites_control_plane` finished=yes rolled_back=no
- `20261010230000_customer_access_invites` finished=yes rolled_back=no
- `20261011120000_lead_pipeline` finished=yes rolled_back=no
- `20261011140000_service_marketplace` finished=yes rolled_back=no
- `20261011160000_infrastructure_assets` finished=yes rolled_back=no
- `20261011180000_automation_notifications` finished=yes rolled_back=no
- `20261011200000_restrict_supabase_api_access` finished=yes rolled_back=no
- `20261012230000_user_preferred_locale` finished=yes rolled_back=no
- `20261013170000_website_preview` finished=yes rolled_back=no
- `20261014190000_batch24_change_requests` finished=yes rolled_back=no
- `20261014193000_batch25_dependency_actions` finished=yes rolled_back=no
- `20261014194500_batch26_project_template_snapshot` finished=yes rolled_back=no
- `20261014203000_batch28_3_owner_review` finished=yes rolled_back=no
- `20261017220000_found01_platform_identity` finished=yes rolled_back=no
- `20261018130000_agent03_internal_workforce` finished=yes rolled_back=no
- `20261018170000_social04_marketing_studio` finished=yes rolled_back=no
- `20261018180000_social04a_integrity` finished=yes rolled_back=no
- `20261018190000_crm05_foundation` finished=yes rolled_back=no
- `20261018200000_crm05a_integrity` finished=no rolled_back=yes

## Public table names

- `Account`
- `AgentToolGrant`
- `AgentToolInvocation`
- `AutomationDeliveryJob`
- `AutomationEvent`
- `BillingGroup`
- `BillingGroupMembership`
- `BillingGroupRole`
- `BillingProfile`
- `BusinessEmailService`
- `BusinessSocialConnection`
- `ChangeRequest`
- `CreditReservation`
- `CreditWallet`
- `CustomerAccount`
- `CustomerMembership`
- `CustomerNotificationPreference`
- `CustomerService`
- `HostingService`
- `InfrastructureActivity`
- `InfrastructureRenewalReminder`
- `InternalAgentConfiguration`
- `InternalAgentDefinition`
- `LeadActivity`
- `ManagedDomain`
- `ManagedSite`
- `ManagedSiteCapability`
- `ManagedSiteChange`
- `MarketingArtifact`
- `MarketingRequest`
- `MarketingStudioUsage`
- `MessageUsage`
- `NewsletterSubscriber`
- `Notification`
- `Project`
- `ProjectActivity`
- `ProjectApproval`
- `ProjectComment`
- `ProjectDependency`
- `ProjectFile`
- `ProjectFileLink`
- `ProjectMilestone`
- `ProjectOwnerReviewDecision`
- `ProjectTask`
- `ProviderConnection`
- `SalesLead`
- `ServiceOrder`
- `ServiceOrderActivity`
- `Session`
- `SiteSpendingPolicy`
- `SocialCampaign`
- `SocialCampaignApproval`
- `SocialCampaignRevision`
- `SocialProviderWorkspaceMapping`
- `SocialPublication`
- `SocialPublicationEvent`
- `SocialSchedulingIntent`
- `SupportRequest`
- `User`
- `VerificationToken`
- `WalletLedgerEntry`
- `WebsitePreview`
- `WebsitePreviewVersion`
- `WorkforceApproval`
- `WorkforceAuditEvent`
- `WorkforceBudgetUsage`
- `WorkforceExecution`
- `WorkforcePauseControl`
- `WorkforceTask`
- `WorkforceToolCall`
- `_prisma_migrations`

## Failure evidence (39D)

- Partial chain (~20 finished applies) with missing CRM layer documented in BATCH39D.
- `crm05_foundation` marked applied before CRM DDL existed (pre–PR #93).
