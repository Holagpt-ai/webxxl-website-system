# Paperclip — internal AI workforce staging

Upstream: [paperclipai/paperclip](https://github.com/paperclipai/paperclip) — deploy via upstream Docker files (not vendored in WebXXL).

## Pinned reference (INFRA-02)

| Item | Value |
|---|---|
| Repository | https://github.com/paperclipai/paperclip |
| Inspected tag | **v2026.325.0** (compose at `docker-compose.yml` in tag) |
| Quickstart compose | `docker/docker-compose.quickstart.yml` (embedded DB) |
| Full stack compose | `docker/docker-compose.yml` (PostgreSQL 17) |
| Default port | `3100` |
| License | Verify LICENSE file on pinned tag (open-source; confirm for commercial internal use) |

## Staging approach (approved host)

1. Clone upstream at pinned tag into host path outside this repo, e.g. `/opt/paperclip-upstream`.
2. Copy [env.example](./env.example) to upstream `docker/.env` (`chmod 600`).
3. Apply [docker-compose.staging.override.yml](./docker-compose.staging.override.yml):

```bash
docker compose -f docker/docker-compose.yml -f /path/to/webxxl/infra/services/paperclip/docker-compose.staging.override.yml up --build -d
```

4. Bind `127.0.0.1:13100:3100`; set `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` and `PAPERCLIP_DEPLOYMENT_MODE=authenticated`.

## Boundaries (WebXXL policy)

- Internal staff/agent identity only — not customer-facing CRM.
- Integrates with `WorkforceProvider` + AI Tool Registry (`lib/platform/ai-tools/*`).
- **Denied:** unrestricted production DB access, raw provider secrets to agents, autonomous production deploy, customer financial actions, clinical/PHI processing, autonomous live outreach.
- Emergency pause and human override required before AGENT-03 production pilot.

## Resources

- Quickstart: ~2 GB RAM minimum for single container; full stack + agents higher during runs.
- `pids_limit: 2048` in upstream quickstart — do not remove on shared VPS.

## Backup

- Named volume `pgdata` / bind `data/docker-paperclip` per upstream docs.
- Export agent/task audit from Paperclip UI/API when available in AGENT-03.

## Blockers

- Requires **build** from upstream Dockerfile (no official pre-published Hub image documented in INFRA-02 inspection).
- LLM keys (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) required for agent execution — supply via host env only.
