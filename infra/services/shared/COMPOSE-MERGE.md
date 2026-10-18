# Docker Compose merge tags (INFRA-02A)

Paperclip and Postiz staging files merge with **upstream** compose using Docker Compose **v2.24.0+** list merge tags:

- `!override` — replace merged list (e.g. published ports).
- `!reset []` — remove inherited host port mappings.

Verify locally:

```powershell
docker compose version  # must be v2.24+
```

Effective config (Paperclip example on host with upstream clone):

```powershell
$env:BETTER_AUTH_SECRET = "local-config-test-only"
$env:PAPERCLIP_TOOL_ACTION_SIGNING_SECRET = "local-config-test-only"
$env:PAPERCLIP_POSTGRES_USER = "paperclip"
$env:PAPERCLIP_POSTGRES_PASSWORD = "local-config-test-only"
docker compose -f docker/docker-compose.yml -f /path/to/webxxl/infra/services/paperclip/docker-compose.staging.override.yml config
```

Postiz uses `fixtures/upstream.docker-compose.yaml` in-repo only for automated `docker compose config` checks in CI/dev.

Chatwoot effective validation copies `docker-compose.staging.yml` into a **system temp directory** with a synthetic `.env` there only. It never reads, writes, or deletes `infra/services/chatwoot/.env`.
