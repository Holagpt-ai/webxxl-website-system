# Cursor Cloud Workforce — Operating Instructions V1

**Status:** configuration only · **Activation:** supervised, on-demand · **Schedules:** none  
**Authority:** root [`AGENTS.md`](../../AGENTS.md), [`docs/platform/docs/00-SESSION-START.md`](../platform/docs/00-SESSION-START.md), [`docs/platform/docs/01-MASTER-TAD.md`](../platform/docs/01-MASTER-TAD.md), AGENT-03 in [`docs/platform/docs/06-AI-WORKFORCE.md`](../platform/docs/06-AI-WORKFORCE.md), and [`lib/platform/workforce/internal-agents.ts`](../../lib/platform/workforce/internal-agents.ts).

This directory defines **five Cursor Cloud Agent roles** for WebXXL. It does **not** enable Paperclip, LLM execution, AUTO-10 dispatch, or recurring automations. Each run is started explicitly by the owner or Engineering Coordinator.

## Roles

| Role | Instruction file | Internal agent key (reference) |
|---|---|---|
| Project Manager | [`project-manager.md`](project-manager.md) | `internal_agent_project_manager_v1` |
| Engineer | [`engineer.md`](engineer.md) | `internal_agent_engineer_v1` |
| QA Reviewer | [`qa-reviewer.md`](qa-reviewer.md) | `internal_agent_qa_reviewer_v1` |
| Documentation | [`documentation.md`](documentation.md) | `internal_agent_documentation_v1` |
| Operations | [`operations.md`](operations.md) | `internal_agent_operations_v1` |

Shared path ownership, prohibited actions, and handoff format: [`SHARED-BOUNDARIES.md`](SHARED-BOUNDARIES.md).

## Supervision model (V1)

1. **One active assignment per agent run** — bounded batch or verification task with explicit scope in the prompt.
2. **No agent may spawn other agents** unless the owner prompt names a delegated sub-task and the child role file allows it.
3. **No merge, deploy, migration apply, flag ON, provider connect, or live send** without separate owner authorization recorded in the assignment.
4. **Evidence hierarchy:** GitHub → Vercel (SHA only) → repository docs → ChatGPT/v0 handoffs. Never treat chat as merge or deploy proof.
5. **Cost control:** prefer focused tests and continuity validators over full-repo audits; avoid repeated LLM-heavy exploration; stay within the WebXXL Cloud Development environment; do not provision new infrastructure in V1.
6. **End every run** with a copyable handoff block (see SHARED-BOUNDARIES) or `WEBXXL HANDOFF` when the owner requests session close.

## Cursor Project setup (manual)

After this configuration merges, the owner configures **five separate Cursor Cloud Agents** (or Projects) in the dashboard:

- Link each to the **WebXXL Cloud Development** environment and this repository.
- Paste the role file contents (or link the path) into each agent’s **custom instructions**.
- Always include root `AGENTS.md` in the project rules or first-read list.
- Do **not** attach production database URLs, LLM API keys, or provider secrets to agent environments until a later owner-approved gate.
- Leave **automations, cron, and auto-delegation disabled** until a future workforce batch explicitly approves them.

## Version

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-01 | Initial role instructions; supervised on-demand only |
