# Infrastructure inventory — 2026-10-18 (read-only)

## Hostinger VPS

| Item | Status |
|---|---|
| SSH / hPanel API access from Cursor | **Unavailable** — no authorized Hostinger MCP or credentials in this environment |
| OS, vCPU, RAM, disk, load | **Unknown** — owner action: hPanel → VPS → Overview screenshot or read-only audit |
| Docker / Compose versions | **Unknown** |
| Running containers / compose projects | **Unknown** |
| Networks, volumes, ports, TLS proxy | **Unknown** |
| Backup / restore configuration | **Unknown** |
| Stocksist co-location | **Unknown** — treat as **risk** until confirmed isolated |

**Hosting capacity decision:** **unknown** (insufficient data to approve co-located staging). Default recommendation: **dedicated staging VPS** before Chatwoot + Postiz Temporal stack + Paperclip.

## Postiz endpoint `https://app.webbxxl.com` (remote read-only probe)

| Check | Result |
|---|---|
| DNS | Resolves `179.236.237.226` (and IPv6) |
| HTTP | `307` → `/auth`; `200` on `/auth` |
| Application identity | HTML title **Postiz Register**, Next.js UI, Postiz branding — **verified Postiz application surface** |
| Reverse proxy | `nginx/1.22.1`, `Via: Caddy` |
| API without credentials | `GET /api/v1/user` → `404` JSON (Express backend present); `GET /public/v1/me` → `307` to `/auth` |
| Social connections | **Not inspectable** without authenticated session |
| Version | **Not verified** (no unauthenticated version endpoint observed) |
| Deployment ownership | **Assumed existing WebXXL/Hostinger ops** — do **not** reinstall or overwrite in INFRA-02 |

## WebXXL production (unchanged this batch)

- Vercel Next.js portal — not modified.
- Supabase / production DB — not modified; FOUND-01 migration not applied from this batch.
