/**
 * Skill Template Workflow Module — apply-team
 *
 * Agent-Team variant of the solo apply workflow. The lead session is the SINGLE
 * writer of all code and tests; a panel of read-only reviewers DERIVED from the
 * change itself (spec-fidelity, regression-adversary, test-strategist, and
 * risk-keyed specialists) reviews each slice's diff in-loop as it lands, catching
 * spec drift while it is still cheap to fix. Tier controls depth, not roster.
 * Hands off to verify-team for the independent gate. Only the lead writes.
 * Claude-only, opt-in.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const APPLY_TEAM_BODY = `Implement an OpenSpec change using a coordinated **Agent Team** — you, the lead, are the **single writer** of all code and tests; a panel of **read-only** reviewers **derived from the change itself** reviews each slice's diff **in-loop as it lands**, so spec drift is caught while it is still cheap to fix.

**The inversion vs verify-team.** verify-team runs a fixed set of dimensions ONCE, at the end, on a finished implementation. apply-team **derives** its review axes from THIS change (a migration change needs a data-migration reviewer; an auth change needs a security reviewer) and runs them **continuously, slice by slice, during** implementation. This is deliberately **not** "apply, then verify-team": the point is to catch implementation-vs-spec drift the moment a slice lands, not after the whole change is built.

**Concurrency model — single-writer + review (non-negotiable).** You, the lead, are the **only** agent that edits the tree — all code AND all tests. Every teammate is a **read-only reviewer / critic / adversary / test-strategist**: they read the diff and the artifacts, then return a **digest** via SendMessage. No teammate writes, edits, stages, or runs mutating commands. This removes write-conflict risk entirely and keeps a single coherent author of the implementation.

**When to use:** medium-to-large or high-risk changes — money/clinical/safety/legal/irreversible effects, data migrations, security-sensitive surfaces, cross-module or public-contract changes, or a stated performance budget — where a single agent would implement a slice and never independently challenge it against the spec. For small or local changes, use solo \`/opsx:apply\` instead.

**Prerequisite:** Claude Code Agent Teams must be enabled (\`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32). You are the **team lead and sole implementer**: you write the code and tests, you collect reviewer digests, you fold in fixes. **No agent other than you edits anything.**

---

**Input:** an optional change name, and an optional tier: \`--tier=lite|standard|deep\` (default: \`standard\`).

## Step 0 — Preflight + staffing (you, the lead — before any team)

Do these in order. Each gate is placed at the **cheapest point that can decide it** — never run heavier work before a cheaper precondition has passed.

1. **Confirm Agent Teams is available (cheapest gate — no CLI).** Check the environment:
   \`\`\`bash
   echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
   \`\`\`
   If empty or the team tools are unavailable, STOP and tell the user to enable Agent Teams (\`export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32) or to run solo \`/opsx:apply\`. Never silently degrade.

2. **Select the change.** If a name was given, use it. Otherwise infer from conversation context, or run \`openspec list --json\` and use the **AskUserQuestion tool** to let the user choose — show changes that have implementation tasks and mark ones with incomplete tasks as "(In Progress)". Do NOT guess or auto-select unless exactly one active change exists. Announce: "Using change: <name>" and how to override (e.g. \`/opsx:apply-team <other>\`).

3. **Derive a team slug (pure string op — no CLI, do this before any TeamCreate reference).** Make a short kebab-case \`<slug>\` from the change name (e.g. "add-user-auth" -> \`add-user-auth\`, "migrate billing to stripe" -> \`migrate-billing\`). You will use it for the team and task names in Step 1.

4. **Check status — and apply the workspace guard FIRST, off \`status\` alone (before the heavier instructions read).**
   \`\`\`bash
   openspec status --change "<name>" --json
   \`\`\`
   Parse it and keep \`schemaName\`, \`changeRoot\`, \`actionContext\`, and which artifact holds the tasks (typically "tasks" for spec-driven — confirm from status).
   If status reports \`actionContext.mode: "workspace-planning"\` and \`allowedEditRoots\` is empty, explain that full workspace apply is not supported in this slice, treat linked repos/folders as read-only context, and STOP — do not form a team and do not run the next command. (Stop here.)

5. **Get apply instructions + read the risk surface (only if not stopped).**
   \`\`\`bash
   openspec instructions apply --change "<name>" --json
   \`\`\`
   This returns \`contextFiles\` (artifact ID -> concrete file paths; for spec-driven: proposal, specs, design, tasks — do NOT assume names, use what the CLI returns), progress (total / complete / remaining), the task list with status, and a dynamic instruction. **Handle states first:**
   - \`state: "blocked"\` (missing artifacts) -> show the message, suggest \`/opsx:continue\`, and STOP (nothing to implement yet).
   - \`state: "all_done"\` -> congratulate, suggest \`/opsx:archive\`, and STOP (do not form a team to do nothing).
   - otherwise -> read every file under \`contextFiles\` (proposal/spec deltas/design/tasks per the schema). This read is your **risk surface**: the proposal's domain, the spec deltas' shape, and the tasks' breadth.

6. **Staffing function: change -> team (this is the heart of the skill). Roster is set by TRIGGERS; tier sets only DEPTH.**
   1. **Derive the roster by trigger (independent of tier/size).** Always staff the fixed three-seat spine. Then run the **trigger table** (below) over what you read in the proposal, spec deltas, and tasks, and add **every** derived seat whose trigger fires — including test-strategist (fires whenever the change carries testable logic or test edits) and each risk specialist on its surface. A risk axis that is present is staffed **at any tier**; risk is not a function of size, so the roster is never gated by the tier knob.
   2. **Pre-team triviality solo-fold (a gate, not the tier knob).** If **no** derived-seat trigger fires AND the diff is trivially small — spine-alone would be pure ceremony (e.g. docs-only, config-only, a pure-mechanical rename) — do NOT form a team: recommend solo \`/opsx:apply\` and stop.
   3. **Pick the tier = how DEEP the review goes (not who is on it).** The roster from 6.1 is the same across tiers; the tier sets cadence and adversarial depth only:
      - **lite** — that roster, **lighter cadence**: coarser slice granularity and fewer review rounds; no extra adversary.
      - **standard** (default) — that roster, **full in-loop per-slice review** (the Step 2 cadence as written).
      - **deep** — standard **plus a second, independent regression-adversary** (re-derives without seeing the first's findings) **and cross-examination of conflicting digests** at the lead.
   Respect an explicit \`--tier\`. Otherwise infer the depth from risk/size, then tell the user the tier you chose, the exact seats the triggers fired and **why each fired**, and how to override.

7. **STOP gate — apply-ready + slice plan (place AFTER the artifact read, since neither can be confirmed more cheaply).** Before forming any team, confirm with the user (or state explicitly and proceed only if unambiguous):
   - the change is in an **apply-ready** state — artifacts present, tasks exist and are not all already complete (you read this in 0.5);
   - a **slice plan** exists — you can name the review-able units you will implement (the cadence unit = one \`tasks.md\` task, or a small cohesive group of tasks that land together).
   If either is missing — e.g. tasks are vague, or the change still needs planning — STOP and point the user to \`/opsx:propose\` / \`/opsx:continue\` rather than implementing against an unready spec. Only after this gate passes do you form the team.

## Step 1 — Form the team + decompose into slices (you)

1. Create the team: \`TeamCreate(team_name: "opsx-apply-<slug>", description: "In-loop review panel for <name>")\`.
2. **Slice \`tasks.md\`.** Break the remaining tasks into ordered, review-able **slices** — each slice is the smallest cohesive unit that produces a diff worth reviewing (one task, or a tight group). This cadence is what makes review cheap and continuous. Record the slice order; you will implement them one at a time.
3. Spawn one teammate per seat in your tier with the **Agent tool** (\`team_name\`, a unique \`name\`, the role prompt). Give EVERY teammate this shared context in its spawn prompt:
   - the change name, \`changeRoot\`, the relevant \`contextFiles\` entries (proposal / spec deltas / design / tasks), and the slice plan;
   - **"You are READ-ONLY. Do NOT write, edit, stage, or run any mutating command — not code, not tests, not artifacts. The lead is the only writer. You review the diff of each slice as it lands and return ONLY your axis's findings to the lead via SendMessage as CRITICAL / WARNING / SUGGESTION items, each with a specific, actionable recommendation and \`file:line\` references where applicable. When uncertain, prefer SUGGESTION over WARNING, WARNING over CRITICAL."**
   - **"Review on your own axis in ISOLATION. Do NOT message other reviewers or ask for their verdicts — axis independence is the point, exactly as in verify-team. Report only to the lead. You will be pinged per slice; review only the slice's diff against the spec, not the whole tree each time."**

   Then append the seat-specific brief from the **archetype palette** below — only for the seats your Step 0.6 staffing actually selected.

## Step 2 — The implement <-> review loop, per slice (THE SIGNATURE)

For each slice N in order:
1. **Lead writes slice N (single-writer).** Implement only that slice's tasks. Keep the diff focused and minimal — it is about to be reviewed on several axes.
2. **On landing slice N, fan out the diff to the firing reviewers + the regression-adversary, in parallel, with NO \`blockedBy\` between them.** They are mutually independent — each reviews the **diff of slice N** on its own axis at the same time (this parallel independence is exactly verify-team's verifier model; premature cross-talk would re-introduce the anchoring this design avoids). Hand each reviewer the slice's diff (e.g. the changed \`file:line\` ranges) and the spec delta it must hold the slice to.
3. **Lead collects the digests and folds in fixes.** Reconcile across axes (de-dupe one defect reported under two axes; resolve conflicts against the evidence). Apply the false-positive bias when YOU are uncertain (SUGGESTION > WARNING > CRITICAL) — but never soften a reviewer's CRITICAL that carries concrete \`file:line\` evidence. You make every edit; reviewers never touch the tree.
4. **Tick the checkbox.** Once slice N's CRITICALs are resolved (or explicitly deferred with the user's agreement), mark its task(s) complete in the tasks file: \`- [ ]\` -> \`- [x]\`. Then proceed to slice N+1.

**Pause the loop if** a slice is unclear (ask before implementing), implementation reveals a design issue (pause and suggest an artifact update — not phase-locked), or a reviewer surfaces a CRITICAL that changes the plan. Don't guess; don't power through a red axis.

Stay context-clean: rely on each reviewer's returned digest, do not pull raw file dumps into your context. This is how the loop scales across many slices.

## Step 3 — Convergence: do the slices compose? (you + the panel)

When all slices are implemented and individually reviewed, run **one cross-slice pass** before standing down:
1. **integration-contract-reviewer** (if staffed) re-reads across slice boundaries: do the slices compose into one coherent change, with no contract broken at the seams between them, no requirement satisfied by one slice and undone by another? Per-slice review cannot see this; this pass is its complement.
2. **test-strategist** confirms **test altitude** across the whole change: every property is tested at the **cheapest correct layer** — pure logic / formulas / parsing in **unit/property** tests (not E2E or a live LLM), a **property test** for any combinatorial space, integration tests for module wiring / error codes / guards, and E2E asserting **wiring only**, never re-exercising lower-layer logic. Any exported pure function in a logic/domain layer must have a **direct** unit test, not just transitive coverage.
3. **Do NOT run the full independent verification here.** That is verify-team's job, and duplicating it would defeat its independence (these reviewers saw the implementation as it was built; an independent panel that never did is the point of the gate). Explicitly hand off: "Implemented and reviewed in-loop, slice by slice. For the independent verification gate, run \`/opsx:verify-team\` (or solo \`/opsx:verify\`)."

## Step 4 — Handoff + teardown (you)

1. Write the **implementation digest** for the user:
   - **What was built** — the slices implemented and tasks now checked (N/M complete).
   - **Which axes were reviewed** — the seats you staffed and why each fired.
   - **What each seat flagged + how it was resolved** — CRITICAL/WARNING/SUGGESTION per axis, each with its resolution (fixed at \`file:line\`, or deferred with reason).
   - **What's deferred** — any task or finding intentionally not addressed, and why (out of scope / needs a decision).
2. Shut down teammates gracefully (SendMessage \`shutdown_request\`), then clean up: \`TeamDelete\`.
3. **Point the user to the independent gate:** if tasks remain, \`/opsx:apply-team\` again for the next batch; when complete, \`/opsx:verify-team\` for independent verification, then \`/opsx:archive\`. Single-writer throughout — you never edited beyond this change's scope.

## The archetype palette (trigger-keyed — staff only the seats that fire)

**Fixed spine (always staffed, every tier):**

| Seat | What it owns |
|------|--------------|
| **lead-implementer (you)** | Not a reviewer — the **sole writer** of all code and tests. Writes each slice, folds in every fix, ticks checkboxes. |
| **spec-fidelity-reviewer** | Holds each slice's diff to the spec deltas + proposal intent: does the code actually implement the stated requirement/scenario, no more (scope creep) and no less (silent gap)? Divergence -> WARNING with \`file:line\` + the requirement it misses; unimplemented requirement touched by the slice -> CRITICAL. |
| **regression-adversary** | Assumes the slice subtly broke something and the author won't see it. Hunts the overlooked CRITICAL: unhappy paths, idempotency / re-run, concurrency, permission/IO failure, cross-platform (Windows paths, case-sensitivity), and behavior the slice changed but a test didn't cover. Re-derives independently; reports high-impact gaps with \`file:line\`. |

**Derived seats (staff a seat ONLY if its trigger fires in the proposal / spec deltas / tasks):**

| Seat | Fires when… | What it reviews (its axis) |
|------|-------------|----------------------------|
| **test-strategist** | the change/slice **adds or modifies testable logic, or introduces/changes tests** (i.e. essentially every code change; folds out for docs/config-only or pure-rename) | Altitude discipline (see Step 3.2). Per slice: are the new tests at the cheapest correct layer, is combinatorial logic a property test (not enumerated examples or a browser/live-LLM run), does each exported pure function get a direct unit test? Mis-altitude -> WARNING with the cheaper layer named. |
| **security-reviewer** | deltas/tasks touch **auth, access control, secrets, or input trust boundaries** | Each slice on those surfaces: authz checks present and correct, no secret logged/leaked, untrusted input validated/escaped at the boundary, no injection/traversal. Concrete exploit path -> CRITICAL with \`file:line\`. |
| **data-migration-reviewer** | deltas **change data shape**, or tasks mention **migrate / backfill / schema** | Migration safety: forward/back compatibility, backfill correctness, nullability/defaults, ordering vs deploy, idempotent + re-runnable, no silent data loss. Unsafe migration -> CRITICAL. |
| **domain-safety-critic** | proposal involves **money, clinical/health, safety, legal, or irreversible effects** | The domain invariant the slice must not violate: monetary rounding/units/double-charge, clinical/safety thresholds, legal/consent ordering, anything irreversible. A violated invariant -> CRITICAL with the rule it breaks. |
| **integration-contract-reviewer** | tasks **span many modules** or change a **public / cross-service contract** | Per slice AND at convergence (Step 3.1): the seam contracts — signatures, wire/serialization shape, versioning/back-compat, error contracts — hold across modules; the slices compose. Broken contract -> CRITICAL with both sides' \`file:line\`. |
| **perf-reviewer** | proposal states a **performance budget** or the slice touches a **hot path** | The hot path the budget protects: complexity regressions, N+1 / unbounded loops, missing pagination/index/cache, allocation in tight loops. A budget-busting regression -> WARNING (CRITICAL if the budget is an explicit SHALL) with \`file:line\`. |

A derived seat is staffed **iff its trigger fires** — independent of the tier. If the risk axis is present the seat is present at **any** tier (lite included); the tier changes only how deep the review goes, never who is on the panel (see Tiers). test-strategist is one such trigger-gated seat: it fires for any change carrying testable logic or test edits, so the altitude guarantee holds across essentially every code change, and folds out cleanly for a docs/config-only or pure-mechanical change. Do not add a seat whose trigger did not fire (no idle seats); do not drop a seat whose trigger fired because the tier is lite. If unsure whether a trigger fires, read the relevant delta once more before deciding.

## Tiers

Tier sets **depth**, not roster: the spine + every firing derived seat is staffed at every tier (the solo-fold below is a separate pre-team triviality gate, not a tier).

| Tier | Cadence + adversarial depth (roster is identical: spine + all firing derived seats) |
|------|--------------------------------------------------------------------------------------|
| lite | lighter cadence — coarser slice granularity, fewer review rounds; no extra adversary |
| standard (default) | full in-loop per-slice review (Step 2 as written) |
| deep | + a second, independent regression-adversary (re-derives blind) + cross-examination of conflicting digests at the lead |

**Solo-fold (not a tier):** if no derived-seat trigger fires AND the diff is trivially small (docs/config/pure-mechanical — spine alone would be ceremony), skip the team and use solo \`/opsx:apply\` (Step 0.6.2).

## Guardrails

- **Single writer, always.** You, the lead, are the only agent that edits the tree — all code and all tests. Every teammate is strictly read-only and returns digests. No teammate writes, stages, or runs a mutating command.
- **Staffing function, not a fixed roster.** Roster is set by TRIGGERS: the fixed three-seat spine + every derived seat whose trigger fires (test-strategist for any testable-logic/test change; risk specialists on their surfaces), staffed at **any** tier. Tier sets only depth. If no trigger fires and the diff is trivially small, solo-fold to \`/opsx:apply\`.
- **Tier = depth, not roster.** lite = lighter cadence; standard = full per-slice review; deep = + a second independent adversary + cross-examination. A present risk axis is never dropped because the tier is lite.
- **Continuous in-loop review (the signature).** Review runs slice by slice as code lands, not once at the end — that is what makes this distinct from "apply then verify-team" and what catches drift while it is cheap.
- **Axis independence.** Per slice, the reviewers run in parallel with NO \`blockedBy\` between them and never see each other's verdicts; reconciliation happens at you. False-positive bias when you are uncertain (SUGGESTION > WARNING > CRITICAL) — but never soften a substantiated CRITICAL.
- **Altitude discipline.** test-strategist is staffed for every change that carries testable logic or test edits (it folds out only for docs/config-only or pure-rename): pure logic -> unit/property tests, combinatorial spaces -> property tests, E2E asserts wiring only, every exported pure function gets a direct unit test.
- **Don't duplicate the gate.** apply-team implements + reviews in-loop; it does NOT run the full independent verification. Hand off to \`/opsx:verify-team\` for that.
- **Stay in scope, stay context-clean.** Never edit beyond the change's scope; coordinate on digests, not raw file dumps. Update each task's checkbox immediately after its slice's CRITICALs clear.
- **Right-size.** Don't form a team when the solo-fold triviality gate fires (no trigger + trivially small diff); redirect to solo \`/opsx:apply\`. Pause on unclear tasks, design issues, or a plan-changing CRITICAL — don't guess.
- **Experimental dependency.** If Agent Teams is unavailable, stop and offer solo \`/opsx:apply\`.`;

export function getApplyTeamSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-apply-team',
    description: 'Implement an OpenSpec change using a coordinated Agent Team — the lead is the single writer of all code and tests while a derived panel of read-only reviewers (spec-fidelity, regression-adversary, test-strategist, and risk-keyed specialists) reviews each slice\'s diff in-loop as it lands, catching drift from the spec while it is cheap. Use for medium-to-large or high-risk changes; hand off to /opsx:verify-team for the independent gate. Requires Claude Code Agent Teams.',
    instructions: APPLY_TEAM_BODY,
    license: 'MIT',
    compatibility: 'Requires openspec CLI and Claude Code Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxApplyTeamCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Apply (Team)',
    description: 'Implement an OpenSpec change with a coordinated Agent Team — the lead single-writes code and tests while a change-derived panel of read-only reviewers reviews each slice in-loop; hand off to verify-team for the independent gate (experimental; requires Agent Teams)',
    category: 'Workflow',
    tags: ['workflow', 'team', 'agents', 'apply', 'experimental'],
    content: APPLY_TEAM_BODY,
  };
}
