## Context

OpenSpec workflows are two layers: a deterministic CLI that serves state/instructions as JSON, and tool-agnostic markdown skills that tell an agent how to drive that CLI. Every OPSX skill today is single-agent — one context interviews, explores, plans, and writes. Claude Code **Agent Teams** (experimental; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, Claude Code ≥ v2.1.32) provide a different primitive than subagents: persistent teammates with their own context windows that message each other by name, share a task list, and challenge each other before converging. This change introduces the first team-based workflow, `propose-team`, while leaving the solo workflows untouched.

Two facts shape the design:

1. **The generator emits only skills and commands.** `src/core/command-generation/` and the skill pipeline write `.claude/skills/**/SKILL.md` and per-tool command files. There is no path that emits `.claude/agents/*.md` role definitions or touches `settings.json`. Specialist teammates therefore require a net-new emission capability.
2. **Teammates load project + user skills/MCP normally**, even though a role definition's `skills`/`mcpServers` frontmatter is ignored when it runs as a teammate. So a recon teammate already has the `openspec` CLI and `openspec-*` skills available — role definitions only need to carry `tools` and `model`.

## Goals / Non-Goals

**Goals:**
- Deliver `propose-team` end-to-end as a vertical slice: playbook skill + specialist role definitions + opt-in Claude-only installation + a validation gate.
- Be strictly additive — the `core` profile, other tools, and user settings are unchanged.
- Keep the lead context-clean so the workflow scales to large codebases.

**Non-Goals:**
- `explore-team`, `verify-team`, `apply-team` (follow-up changes).
- Writing or merging the user's `.claude/settings.json`.
- Auto-detecting complexity tier (the human selects the tier for v1).
- Changing the solo `propose`/`explore`/`apply` skills.

## Decisions

**D1 — `propose-team` is a team-playbook skill, not a subagent fan-out.** The skill body is the lead's instructions: preflight (env check, `openspec new change`, `status --json`) → `TeamCreate` → spawn the tier's roster as teammates → seed the shared task list with dependency edges → bounded peer debate → readiness gate → single-author synthesis via `openspec instructions` → `validate --strict` → cleanup. *Alternative rejected:* subagents — they cannot message each other, so the challenge/debate dynamic (the whole point) is impossible.

**D2 — Roster + tiering.** The lead (the running session) is the orchestrator and sole author. Specialist teammates: `opsx-recon` (codebase cartographer; may fan out for large repos), `opsx-problem-framer` (job-to-be-done + success metrics), `opsx-scope-steward` (capability decomposition + anti-scope-creep + existing-spec lookup), `opsx-happy-path` (primary scenarios), `opsx-edge-adversary` (unhappy/edge/cross-platform scenarios; challenges happy-path), `opsx-nfr-skeptic` (non-functional requirements + red-team). Tiers select a subset: `lite` = recon + happy-path + edge-adversary; `standard` adds problem-framer + scope-steward; `deep` adds nfr-skeptic. Below `lite`, the workflow redirects to solo `propose`.

**D3 — Single-author enforced at the tool allowlist.** Only the lead writes artifacts. Specialist role definitions omit `Write`/`Edit` entirely, so a teammate physically cannot author an artifact file — belt-and-suspenders with the orchestration instruction. Per-capability spec files may be written in parallel only because their paths are disjoint (one writer per file).

**D4 — New `agent-generation/` module.** Mirror `command-generation/`: `types.ts` (`AgentContent`, `ToolAgentAdapter`), `generator.ts`, `registry.ts`, `adapters/claude.ts` emitting `.claude/agents/<id>.md` with `name`/`description`/`tools`/`model` frontmatter. *Alternative rejected:* extending `ToolCommandAdapter` with agent methods — pollutes the command abstraction; a parallel module matches the repo's single-responsibility shape.

**D5 — Do not mutate `settings.json`; embed the validation gate in the skill.** The skill runs `openspec validate --strict` and loops on failure. Optionally emit a documented `.example.json` hook (TaskCompleted → `openspec validate`) the user merges by hand. *Alternative rejected (for v1):* OpenSpec writing `settings.json` hooks — that file is user-owned and frequently hand-edited; a non-destructive merge is the largest and riskiest surface and is not required for the gate to work.

**D6 — Opt-in, Claude-only, never in `core`.** Add `propose-team` to `ALL_WORKFLOWS` only (reachable via the `custom` profile), never to `CORE_WORKFLOWS`. Gate skill + role-def + hook emission to `tool === 'claude'`. This reuses the existing profile opt-in machinery with no new flag and ships nothing dead to other tools.

**D7 — Tier is a skill argument, not a separate command.** `propose-team "<idea>" --tier=lite|standard|deep`, parsed in the skill body, mirroring how solo `propose` takes a free-form argument. Keeps the registry surface to one skill/one command.

**D8 — Debate is bounded; ties become open questions.** Hard cap of 2 challenge rounds (configurable per tier). Unresolved disagreements are written as Open Questions in `design.md` rather than looping — undecided is a legitimate artifact outcome, not a blocker. The lead counts rounds; teammates do not.

**D9 — Role-definition naming: `opsx-<role>`.** Matches the user-facing `opsx` command namespace and keeps team roles visually distinct from the `openspec-<workflow>` skill directories.

## Risks / Trade-offs

- **Net-new generator surface (role-def emission + idempotent removal).** → Mirror the well-tested command-generation path exactly; add a parallel `test/core/agent-generation/` suite and removal cases.
- **Parity test breaks on registration.** `skill-templates-parity.test.ts` pins sha256 baselines for every template and generated skill; the build fails until baselines are added. → Treat baseline updates as a required task, not an afterthought.
- **Token cost is multiples of solo.** → Opt-in + tiering + bounded debate + the lead-context firewall (distilled findings only) are the cost controls; `sonnet` for high-volume roles, `opus` for the two critics.
- **Single-author bottleneck at the lead.** → Accepted to avoid file conflicts; mitigated by teammates returning near-final draft blocks (especially scenarios) the lead integrates rather than re-authors.
- **Experimental dependency.** Agent Teams may change. → The skill hard-gates on the env flag and degrades to a clear "use solo" message; nothing else in OpenSpec depends on teams.

## Open Questions

- Confirm the validation gate stays skill-embedded for v1 (D5), or do we want the hard `TaskCompleted` hook now (adds the non-destructive `settings.json` merge surface)?
- Should success metrics be their own `opsx-metrics` seat, or stay folded into `opsx-problem-framer` (current choice, to hold the 3–5 sweet spot)?
- Role-definition naming `opsx-*` (D9) vs `openspec-*` (to match skill `name:` fields) — bikeshed; confirm before baselines are pinned.
