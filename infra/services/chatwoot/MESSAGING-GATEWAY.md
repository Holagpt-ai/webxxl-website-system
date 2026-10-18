# WebXXL messaging gateway (future COMMS-06)

Chatwoot must **not** become an uncontrolled billing path to Twilio or other carriers.

## Target architecture

```mermaid
sequenceDiagram
  participant Agent as Chatwoot agent UI
  participant CW as Chatwoot API
  participant GW as WebXXL messaging gateway
  participant CRM as WebXXL CRM/consent
  participant W as Wallet/reservations
  participant TW as Twilio (WALLET-09)

  Agent->>CW: Compose outbound SMS (API channel)
  CW->>GW: Webhook/API channel message request
  GW->>CRM: Consent + account scope check
  GW->>W: Reserve/settle credits
  GW->>TW: Send (authorized subaccount)
  TW-->>GW: Delivery receipt
  GW-->>CW: Mirror message state
  GW-->>CRM: Timeline event
```

## Rules

- Outbound billable SMS/email only through WebXXL gateway after consent, wallet, and approval policies.
- Inbound routes map provider destination → exactly one `customerAccountId`.
- ABMED sibling accounts never share suppression lists or sender identities without explicit policy.
- No live SMS/WhatsApp/campaign configuration in INFRA-02.

## Chatwoot configuration direction

- Prefer **API Channel** and server-side integration over native Twilio channel credentials in Chatwoot.
- Store Chatwoot account/inbox IDs in WebXXL mapping table (see `chatwoot-account-mapping.ts`).
