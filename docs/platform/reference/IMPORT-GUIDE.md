# How to install this WebXXL architecture package into GitHub

**No repository changes have been made by packaging these files.** A documentation PR is the recommended first Git step. It does not deploy production features.

## Installation target

In `Holagpt-ai/webxxl-website-system`, create a documentation-only branch from current `main` and copy this package **as a folder** to `docs/platform/`, preserving paths:

```text
repo/
  README.md                            # existing repository README; KEEP intact
  docs/
    platform/
      README.md                        # blueprint index and permanent session entrypoint
      docs/
        00-SESSION-START.md
        01-MASTER-TAD.md
        ... 16-PROVIDER-REGISTER.md
      reference/
        CURSOR-KICKOFF.md
        IMPORT-GUIDE.md
        webxxl-working-dashboard-2026-10-17.png
```

Add a short link to `docs/platform/README.md` from the **existing** root repository `README.md`; do not overwrite unrelated README instructions. Open a PR labelled `docs: WebXXL unified platform TAD v1.0.0`. Review documentation changes and approve the baseline before merges/implementation. The reviewer should check provider evidence and confirm open decisions, especially whether the free marketing offer is available to non-subscribers.

## Mandatory prompt for all future WebXXL work sessions

> Before any WebXXL implementation, read `docs/platform/README.md`, `docs/platform/docs/00-SESSION-START.md`, `docs/platform/docs/01-MASTER-TAD.md`, `docs/platform/docs/02-CURRENT-STATE.md`, `docs/platform/docs/15-DECISIONS-CHANGELOG.md`, and all relevant module specs. State the TAD version, actual Git branch/SHA, current work batch, implemented/verified/planned/deferred states, exact file owners, and acceptance tests. Preserve the working dashboard and approved no-downgrade scope. Cursor owns backend/DB/APIs/deployment; v0.app owns ALL customer/admin/public UI; Vercel hosts WebXXL. Never perform production sends, billing or deployment without explicit authorization.

## Version updates

After each accepted batch, update current state and roadmap evidence; change decisions require an ADR and explicit owner approval. Status labels should reference build SHA, environment and date; intended features cannot be relabeled as verified.
