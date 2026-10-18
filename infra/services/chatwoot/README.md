# Chatwoot — WebXXL staging stack

Upstream: [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) — **Community Edition** Docker deployment per [official Docker guide](https://developers.chatwoot.com/self-hosted/deployment/docker).

## Pinned release (INFRA-02)

| Component | Pin |
|---|---|
| Application image | `chatwoot/chatwoot:v4.18.0-ce` ([Docker Hub tag](https://hub.docker.com/r/chatwoot/chatwoot/tags)) |
| PostgreSQL | `pgvector/pgvector:pg16` (per upstream `docker-compose.production.yaml`) |
| Redis | `redis:7-alpine` |

Digest pinning: record `docker inspect chatwoot/chatwoot:v4.18.0-ce --format '{{index .RepoDigests 0}}'` on the staging host before first production-adjacent test.

## Components

- **rails** — web/API (bound `127.0.0.1:13000` in staging file)
- **sidekiq** — background jobs
- **postgres** — Chatwoot database (pgvector)
- **redis** — cache/queue

## Health

- App: `curl -fsS http://127.0.0.1:13000/api` → expect HTTP 200 (upstream documents this check).
- Sidekiq: process health via container running state; optional `docker compose ps`.

## First-time DB prepare (approved host only)

```bash
cd infra/services/chatwoot
cp env.example .env   # host only, gitignored
docker compose -f docker-compose.staging.yml run --rm rails bundle exec rails db:chatwoot_prepare
docker compose -f docker-compose.staging.yml up -d
```

## Backup / restore

- Volumes: `webxxl_stg_chatwoot_postgres_data`, `webxxl_stg_chatwoot_storage_data`, `webxxl_stg_chatwoot_redis_data`.
- Restore: stop stack, restore volume snapshot, start stack, run `db:chatwoot_prepare` only if upstream upgrade notes require it.

## Upgrade / rollback

1. Read [Chatwoot release notes](https://github.com/chatwoot/chatwoot/releases) between current and target tag.
2. Update image tag in `docker-compose.staging.yml`.
3. `docker compose pull` → `docker compose up -d` → `docker compose run --rm rails bundle exec rails db:chatwoot_prepare`.
4. Rollback: revert tag, restore DB snapshot if migration incompatible.

## WebXXL integration

- `ConversationProvider` adapter remains **candidate** until COMMS-06; mapping types in `lib/platform/integrations/chatwoot-account-mapping.ts`.
- Future **messaging gateway** (no Chatwoot→Twilio billing bypass): [MESSAGING-GATEWAY.md](./MESSAGING-GATEWAY.md).
- ABMED Aesthetics, Physicians Group, and Clinical Research require **separate** Chatwoot accounts or proven inbox isolation — never shared conversation namespaces.

## License / edition notes

- Upstream OSS license: MIT (verify on pinned release). Enterprise-only features require separate edition due diligence — do not assume marketing-page AI/enterprise features exist in CE.
