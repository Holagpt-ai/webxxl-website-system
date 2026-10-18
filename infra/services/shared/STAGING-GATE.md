# Staging deployment gate (INFRA-02)

Repository manifests are **ready**; **running** staging is a separate owner-approved step.

## Preconditions checklist

- [ ] `origin/main` includes FOUND-01 merge (`68c5fde5345813899e2db34ac422a90cb5956f52` or later).
- [ ] FOUND-01 Prisma migration `20261017220000_found01_platform_identity` status recorded (typically **not applied** to production Supabase).
- [ ] Hostinger/VPS inventory completed or marked **unknown** (see `inventory-2026-10-18.md`).
- [ ] Stocksist containers, networks, volumes, and secrets confirmed **not referenced** by WebXXL staging compose project names.
- [ ] Separate staging VPS approved **or** co-location risk accepted in writing.
- [ ] Secrets created on host only (`.env` files gitignored; use `*.example` templates from this repo).
- [ ] Reverse proxy / admin exposure plan: prefer VPN/Tailscale; no public Paperclip admin without auth + TLS.

## Allowed operator commands (on approved host only)

From repository root, after copying env files:

```powershell
# Static validation (safe anywhere)
./infra/services/scripts/validate-config.ps1

# Read-only HTTP checks (no Docker mutation)
./infra/services/scripts/health-readonly.ps1 -Service chatwoot -BaseUrl http://127.0.0.1:13000

# Scoped lifecycle (requires explicit project + service)
$env:WEBXXL_STAGING_SERVICE = "chatwoot"
./infra/services/scripts/staging-up.ps1
```

Scripts **refuse** to run without `WEBXXL_STAGING_SERVICE` and matching `name:` in the target compose file.

## Rollback

1. `./infra/services/scripts/staging-down.ps1` for the same `WEBXXL_STAGING_SERVICE`.
2. Restore volume snapshots documented in service README backup sections.
3. Re-pin image tag/digest in service README and compose file before retry.
