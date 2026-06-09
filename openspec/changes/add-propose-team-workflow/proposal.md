## Why

Every OpenSpec planning action today is driven by one agent that interviews the user, studies the codebase, plans, and writes every artifact in a single context. For medium-to-hard changes that single context is the bottleneck: unhappy-path scenarios, non-functional requirements, success metrics, and scope discipline get dropped, and a large codebase cannot be understood by one agent without saturating its context. Real discovery is a conversation between perspectives — product, the happy path, the failure modes, metrics, and the existing system — that challenge each other before anything is committed.

## What Changes

- Add an opt-in `propose-team` workflow: a Claude Code **Agent Team** variant of `/opsx:propose` where a lead session coordinates a panel of specialist teammates who investigate in parallel, **challenge each other**, and converge before any artifact is written.
- The lead is the **single author** of all planning artifacts; teammates contribute findings only. The lead coordinates on distilled findings, not raw file dumps, so its context does not saturate on large codebases.
- The workflow is **tiered** (`lite` / `standard` / `deep`) so effort scales with change size. Trivial changes are redirected to solo `/opsx:propose`.
- Quality is **gated**: a lead-run readiness check before authoring, and `openspec validate --strict` before the change is reported ready.
- Add the ability to install the specialist **role definitions** for Claude (`.claude/agents/opsx-*.md`) and the `propose-team` skill, opt-in via the `custom` profile and **Claude-only**, without changing the default `core` profile, other tools, or user settings.
- Scope: this change delivers `propose-team` only. `explore-team`, `verify-team`, and `apply-team` are follow-ups and out of scope here.
- Not **BREAKING**: nothing is removed or changed for existing `core`-profile users; the team workflow is additive and must be explicitly enabled.

## Capabilities

### New Capabilities

- `team-discovery-workflow`: The behavior of the opt-in `propose-team` Agent Team workflow — specialist roster, complexity tiering, parallel investigation, bounded peer debate, single-author synthesis, and the validation gate that produces standard OpenSpec planning artifacts.
- `agent-role-generation`: Installing and removing the Claude specialist role definitions and the `propose-team` skill during `openspec init` / `openspec update`, scoped to the Claude tool and the opt-in profile.

### Modified Capabilities

- (none — all behavior is additive; existing capabilities are unchanged)

## Impact

- **New code**: `src/core/templates/workflows/propose-team.ts` (the team playbook skill); `src/core/agent-generation/` (new module: types, generator, registry, `adapters/claude.ts`) mirroring `command-generation/`; a role-definition registry for the specialist roles.
- **Registration**: `src/core/shared/skill-generation.ts`, `src/core/templates/skill-templates.ts`, `src/core/profiles.ts` (add to `ALL_WORKFLOWS`, not `CORE_WORKFLOWS`), `src/core/shared/tool-detection.ts`.
- **Install/update wiring**: `src/core/init.ts` and `src/core/update.ts` — Claude-gated emission and idempotent removal of role definitions.
- **Tests**: `test/core/templates/skill-templates-parity.test.ts` (hash baselines), `tool-detection`, `skill-generation`, `profiles`, `init`, `update`, `config-profile`, plus a new `test/core/agent-generation/` suite.
- **Docs**: `docs/opsx.md` and `docs/commands.md` — document `propose-team`, the tiers, and the prerequisites (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, Claude Code ≥ v2.1.32).
- **No runtime dependency changes.** Operation requires the user's Claude Code to have Agent Teams enabled.
