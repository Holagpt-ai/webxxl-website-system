# Postiz at app.webbxxl.com — read-only inventory (2026-10-18)

| Question | Finding |
|---|---|
| DNS | `app.webbxxl.com` → `179.236.237.226` |
| Reachable | Yes — HTTPS |
| Application identity | Postiz registration UI (`<title>Postiz Register</title>`, Postiz assets) |
| Version | **Unknown** without admin access |
| API | Unauthenticated API probes redirect or 404; no public stats |
| Linked social accounts | **Unknown** |
| Same host as Stocksist? | **Unknown** |
| Action in INFRA-02 | Document only; prepare **separate** `webxxl-stg-postiz` stack for future SOCIAL-04 testing |

Integration code continues to use link-out + HEAD check via `getSchedulerStatus()`.
