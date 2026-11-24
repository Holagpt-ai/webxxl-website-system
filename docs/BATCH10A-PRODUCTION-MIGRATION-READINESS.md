# Batch 10A — Production migration readiness (authorization required)

**Status:** READY IN GIT · **NOT APPLIED** on Production  
**Source:** PR **#146** · **UI on `main`:** PR **#153** @ `f52ed8f724d54ab0384d62da1030b212126e74ff`

## Migration

```
prisma/migrations/20261123120000_batch10a_crm_company_suppression_lift
```

Adds nullable lift audit fields on `ContactSuppression` and a unique index on `liftIdempotencyKey`. Does **not** grant consent or change suppression semantics.

## Current production ledger

**40/40** — Step 6A **VERIFIED** (2026-11-21). This migration would be **41** when applied.

## Owner authorization checklist

- [ ] Explicit production migrate approval recorded  
- [ ] `DATABASE_URL` targets Production `txfxeehglqfszletuumn`  
- [ ] Backup / rollback window confirmed  
- [ ] Run `prisma migrate deploy` (or approved pipeline) — **not** in this stabilization session  
- [ ] Smoke: `POST /api/v1/crm/contacts/[id]/suppression/lift` idempotency on one test contact  
- [ ] Update [`DEPLOYMENT_STATUS.md`](DEPLOYMENT_STATUS.md) migration column with evidence  

## Out of scope for migrate window

Flag enablement (`CRM_BACKEND_ENABLED`), provider activation, outbound communications, POLICY-SUB-001 changes.

Contract: [`platform/docs/BATCH10A-CRM-COMPANY-CUSTOM-FIELDS.md`](platform/docs/BATCH10A-CRM-COMPANY-CUSTOM-FIELDS.md)