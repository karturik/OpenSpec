> **v1 (this slice — shipped):** skill-first. `propose-team` is a self-contained skill that spawns teammates with **inline** role prompts. Installable and usable now; rides the existing skill pipeline.
> **v2 (deferred):** extract roles into `.claude/agents/opsx-*.md` via a net-new `agent-generation/` module (groups 3, 4, 2.2–2.3, 6.4, 7.2). This satisfies the `agent-role-generation` capability spec; until then that capability is unimplemented.

## 1. Team-playbook skill

- [x] 1.1 Create `src/core/templates/workflows/propose-team.ts` exporting `getProposeTeamSkillTemplate()` and `getOpsxProposeTeamCommandTemplate()`, shaped like `propose.ts`
- [x] 1.2 Write the playbook body: preflight (env-flag check, `openspec new change`, `status --json`) → `TeamCreate` → spawn roster by tier → seed shared task list with dependency edges → bounded debate → readiness gate → single-author synthesis via `openspec instructions` → `validate --strict` → graceful shutdown/cleanup
- [x] 1.3 Parse the `--tier=lite|standard|deep` argument and the small-change redirect to solo `/opsx:propose`
- [x] 1.4 Hard-gate on `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` with a clear fallback message

## 2. Specialist roles

- [x] 2.1 Author the six role briefs (recon, problem-framer, scope-steward, happy-path, edge-adversary, nfr-skeptic) — v1: **inline** in the skill body with "return distilled findings, do not write files" instructions
- [ ] 2.2 (v2) Move the briefs into `.claude/agents/opsx-*.md` with per-role `tools` (no `Write`/`Edit`) and `model` frontmatter
- [ ] 2.3 (v2) Add a role-definition registry (e.g. `src/core/templates/agents/`)

## 3. Agent-generation module (v2 — deferred)

- [ ] 3.1 Create `src/core/agent-generation/types.ts` (`AgentContent`, `ToolAgentAdapter`) mirroring `command-generation/types.ts`
- [ ] 3.2 Create `adapters/claude.ts` — file path `.claude/agents/<id>.md` via `path.join`, frontmatter with `name`/`description`/`tools`/`model`
- [ ] 3.3 Create `generator.ts` and `registry.ts` mirroring the command-generation equivalents

## 4. Install / update wiring (v2 — deferred)

- [ ] 4.1 Emit role definitions in `src/core/init.ts` after the command block, gated on `tool === 'claude'` and `propose-team` active
- [ ] 4.2 Emit and re-sync role definitions in `src/core/update.ts`
- [ ] 4.3 Add idempotent `removeAgentFiles` so deselecting `propose-team` removes managed `.claude/agents/opsx-*.md` and leaves unmanaged files untouched
- [ ] 4.4 Verify cross-platform path handling (`path.join`) and add a Windows CI consideration

## 5. Registration

- [x] 5.1 Re-export the new templates from `src/core/templates/skill-templates.ts`
- [x] 5.2 Register in `getSkillTemplates()` and `getCommandTemplates()` in `src/core/shared/skill-generation.ts`
- [x] 5.3 Add `propose-team` to `ALL_WORKFLOWS` (not `CORE_WORKFLOWS`) in `src/core/profiles.ts`
- [x] 5.4 Add `openspec-propose-team` / `propose-team` to `SKILL_NAMES` / `COMMAND_IDS` in `src/core/shared/tool-detection.ts` and the `WORKFLOW_TO_SKILL_DIR` mappings (`init.ts`, `profile-sync-drift.ts`)

## 6. Tests

- [x] 6.1 Add sha256 baselines + factories for `propose-team` in `test/core/templates/skill-templates-parity.test.ts`
- [x] 6.2 Update `tool-detection`, `skill-generation`, `profiles` expectations (counts 11→12 + membership)
- [x] 6.3 Confirm `init` / `update` / `config-profile` tests stay green (no change needed in v1 — skill rides the existing pipeline)
- [ ] 6.4 (v2) Add `test/core/agent-generation/` suite mirroring `test/core/command-generation/`

## 7. Docs

- [x] 7.1 Add `propose-team` to the `docs/opsx.md` commands table with prerequisites
- [ ] 7.2 (v2) Document the optional `.example.json` TaskCompleted hook and how to merge it

## 8. Verify

- [x] 8.1 `pnpm lint`, `pnpm build`, `pnpm test` green (89 files, 1661 tests)
- [x] 8.2 Dogfood: generated `.claude/skills/openspec-propose-team/SKILL.md` via the real pipeline; confirmed reachable through the `custom` profile
