# Shared logging and backup expectations (staging)

## Logging (Docker)

Each service compose file sets:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Rotate or ship logs on the host; do not disable rotation on long-running staging VMs.

## Backups (before upgrades)

| Service | Data to back up | Minimum frequency (staging) |
|---|---|---|
| Chatwoot | Postgres volume `webxxl_stg_chatwoot_postgres_data`, `storage_data` ActiveStorage | Daily snapshot before upgrade |
| Postiz (staging stack) | Postgres + upload volumes from official compose clone | Daily snapshot; follow Temporal migration docs when upgrading |
| Paperclip | Postgres volume + `/paperclip` bind or named volume | Daily snapshot |

Restore drills must use **isolated** restore volumes, never Stocksist or production Postiz volumes.
