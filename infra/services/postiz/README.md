# Postiz — inventory + separate staging stack

## Existing instance (production candidate)

See [EXISTING-PRODUCTION-CANDIDATE.md](./EXISTING-PRODUCTION-CANDIDATE.md). URL configured in WebXXL: `https://app.webbxxl.com` (`lib/integrations/scheduler.ts`).

**INFRA-02 does not reinstall, upgrade, or reconfigure that deployment.**

## Separate staging stack (when approved)

Official self-host path: clone [gitroomhq/postiz-docker-compose](https://github.com/gitroomhq/postiz-docker-compose) on the staging host (canonical compose + Temporal). Apply WebXXL overlay [docker-compose.staging.overlay.yml](./docker-compose.staging.overlay.yml) to enforce project name, localhost ports, and resource names.

### Pinned application release (reference)

| Item | Value |
|---|---|
| Application repo | [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) |
| Inspected release tag | **v2.25.1** (2026-10-11, security release PSA-2026-4QX1WG) |
| Standalone image (alternative) | `ghcr.io/gitroomhq/postiz-app:latest` per [Postiz Docker docs](https://docs.postiz.com/self-host/installation/docker) — pin explicit tag in host compose after pull |

Staging overlay assumes the upstream compose services; set image tag in upstream `docker-compose.yaml` on the host to `v2.25.1` or digest-pinned equivalent.

### Dependencies (upstream compose)

PostgreSQL, Redis, Postiz app, **Temporal** workflow stack — plan **≥4 GB RAM** for comfortable staging (docs cite 2 GB minimum for Ubuntu 24.04 2 vCPU).

### Health

- Frontend: `http://127.0.0.1:14007` (overlay port)
- Readiness: HTTP 200 on `/` or auth redirect; API requires token (`POSTIZ_API_TOKEN` in WebXXL — not enabled in FOUND-01/INFRA-02)

### WebXXL division of responsibility

| WebXXL owns | Postiz owns |
|---|---|
| Customer authorization, campaign prep, AI drafts, approvals, business social identities, cost policy, status reporting | Scheduled publishing execution, OAuth platform connections, provider-specific publish |

Adapter: `existingPostizSocialProvider` in `lib/platform/providers/existing-adapters.ts` — activation in **SOCIAL-04**.

## License

AGPL-3.0 (upstream `postiz-docker-compose` and `postiz-app`). Review commercial/network use with counsel before production multi-tenant embedding.
