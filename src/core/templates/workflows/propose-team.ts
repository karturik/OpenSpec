/**
 * Skill Template Workflow Module — propose-team
 *
 * Agent-Team variant of the solo propose workflow. The lead session coordinates
 * a panel of specialist teammates who investigate in parallel and challenge each
 * other before the lead synthesizes the planning artifacts. Claude-only, opt-in.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const PROPOSE_TEAM_BODY = `Propose a new change using a coordinated **Agent Team** — specialist teammates investigate in parallel, challenge each other, and converge before the lead writes the planning artifacts.

**When to use:** medium-to-hard changes where a single agent would drop unhappy paths, non-functional requirements, success metrics, or scope discipline — or cannot hold a large codebase in one context. For small or local changes, use solo \`/opsx:propose\` instead.

**Prerequisite:** Claude Code Agent Teams must be enabled (\`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32). You are the **team lead**: you coordinate the panel and you are the **only** agent that writes artifact files.

---

**Input:** a change idea (kebab-case name or a description), and an optional tier: \`--tier=lite|standard|deep\` (default: \`standard\`).

## Step 0 — Preflight (you, the lead)

1. **Confirm Agent Teams is available.** Check the environment:
   \`\`\`bash
   echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
   \`\`\`
   If empty or the team tools are unavailable, STOP and tell the user to enable Agent Teams (\`export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32) or to run solo \`/opsx:propose\`. Never silently degrade.

2. **Size the change → pick a tier.**
   - **small** (trivial/local, one capability, no new dependencies): do NOT form a team. Recommend solo \`/opsx:propose\` and stop.
   - **lite**: recon + happy-path + edge-adversary.
   - **standard**: lite + problem-framer + scope-steward.
   - **deep**: standard + nfr-skeptic.
   Respect an explicit \`--tier\`. Otherwise infer the tier, then tell the user which tier you chose and how to override it.

3. **Derive a kebab-case change name** from the idea (e.g. "add user auth" -> \`add-user-auth\`). If the idea is unclear, use the **AskUserQuestion tool** before proceeding.

4. **Scaffold the change and read its paths:**
   \`\`\`bash
   openspec new change "<name>"
   openspec status --change "<name>" --json
   \`\`\`
   Keep \`changeRoot\`, \`artifactPaths\`, \`applyRequires\`, and \`actionContext\` from the status JSON — these are the source of truth you hand to teammates. Do not assume repo-local paths.

## Step 1 — Form the team

1. Create the team: \`TeamCreate(team_name: "opsx-propose-<name>", description: "Discovery panel for <name>")\`.
2. Spawn one teammate per role in your tier with the **Agent tool** (\`team_name\`, a unique \`name\`, and the role prompt). Give EVERY teammate this shared context in its spawn prompt:
   - the change idea and the change name;
   - \`changeRoot\` and \`artifactPaths\` from Step 0;
   - **"You are read-only. Do NOT write or edit any file. Investigate, then send the lead a distilled digest (<=8 bullets, with file:line references where relevant) via SendMessage. Challenge other teammates by name when you disagree."**

   Then append the role-specific brief:

   - **recon** — Map the part of the codebase this change touches: affected files, integration points, existing patterns, and which existing \`openspec/specs/\` capabilities are involved. Return the blast radius and likely Modified Capabilities. (For a large codebase, spawn several recon teammates over different areas.)
   - **happy-path** — Define the primary success flows as testable scenarios (WHEN/THEN). Own the proposal's main capability behavior.
   - **edge-adversary** — Hunt the unhappy paths: empty/invalid/huge input, concurrency, partial failure, idempotency/re-run, permission/IO errors, and cross-platform (Windows paths, case-sensitivity). Write each as a WHEN/THEN scenario. Actively challenge happy-path's coverage by name.
   - **problem-framer** — Own the proposal's Why: the job-to-be-done, who it serves, why now, and 1-2 measurable success metrics plus a guardrail metric.
   - **scope-steward** — Own capability decomposition and scope discipline: New vs Modified capabilities (look up existing \`openspec/specs/\` names), an explicit Non-Goals list, BREAKING flags, and Impact. Challenge any contribution that exceeds the job.
   - **nfr-skeptic** — Surface non-functional requirements (limits, performance, security/privacy, accessibility, observability) as SHALL + scenario, list the proposal's load-bearing assumptions, and red-team every other teammate's findings.

## Step 2 — Seed the shared task list

Create one task per role with **TaskCreate**, plus a synthesis task you own. Use \`blockedBy\` so scenario roles wait on recon and synthesis waits on the panel:
- recon (no deps); problem-framer (no deps); scope-steward (blockedBy recon);
- happy-path, edge-adversary (blockedBy recon); nfr-skeptic (blockedBy the above);
- "synthesize artifacts" (owner: you; blockedBy all panel tasks).

## Step 3 — Bounded debate (the point of the team)

Let teammates work and message each other. Drive a **bounded** challenge:
- edge-adversary and nfr-skeptic must each file at least one concrete, addressed objection (e.g. "@happy-path: your export flow has no empty-data scenario — add WHEN/THEN").
- scope-steward flags anything out of scope.
- **Hard cap: 2 challenge rounds.** Do not loop further. Any disagreement still open after round 2 becomes an **Open Question in design.md** — undecided is a valid outcome, not a blocker.
- You count the rounds; teammates do not. Stay context-clean: rely on their digests, do not pull raw file dumps into your context.

## Step 4 — Readiness gate (you)

Before writing anything, confirm:
- every artifact in \`applyRequires\` is covered by at least one teammate's findings;
- both happy and unhappy paths are present (no all-green roster);
- recon named concrete files/specs (not "TBD");
- the adversary's blocking objections are resolved or explicitly deferred.
If a gap remains, send the owning teammate targeted feedback and wait for a revision.

## Step 5 — Single-author synthesis (you only)

You are the only writer. For each artifact in dependency order from \`status --json\`:
\`\`\`bash
openspec instructions <artifact-id> --change "<name>" --json
\`\`\`
Use its \`template\`, \`instruction\`, \`context\`, \`rules\`, \`dependencies\`, and \`resolvedOutputPath\`. Read the relevant teammate digests and dependency files, then write the artifact yourself. \`context\`/\`rules\` are constraints for you — never copy them into the file. Write \`specs/<capability>/spec.md\` per capability (disjoint files). Re-run \`status --json\` after each write until every \`applyRequires\` artifact is \`done\`.

## Step 6 — Validation gate

\`\`\`bash
openspec validate "<name>" --strict
\`\`\`
If it reports errors, fix the artifacts and re-validate. Do NOT report the change ready until validation passes.

## Step 7 — Stand down

Shut down teammates gracefully (SendMessage \`shutdown_request\`), then clean up the team. Report: change name and path, artifacts created, the tier used, and any Open Questions. Point the user to \`/opsx:apply\`.

## Tiers

| Tier | Roster (besides you) | Debate rounds |
|------|----------------------|---------------|
| small | — (use solo \`/opsx:propose\`) | — |
| lite | recon, happy-path, edge-adversary | 1 |
| standard | + problem-framer, scope-steward | 2 |
| deep | + nfr-skeptic | 2 |

## Guardrails

- **You are the only writer.** Teammates are read-only and return findings; you synthesize and write every artifact. Never let a teammate write \`proposal.md\` / \`specs\` / \`design.md\` / \`tasks.md\`.
- **Bounded debate.** At most 2 challenge rounds; unresolved items become Open Questions, not another round.
- **Stay context-clean.** Coordinate on digests, not raw file dumps — that is how this scales to large codebases.
- **Gate before done.** Strict validation must pass before you report the change ready.
- **Right-size.** Don't form a team for trivial changes; redirect to solo \`/opsx:propose\`.
- **Experimental dependency.** If Agent Teams is unavailable, stop and offer solo \`/opsx:propose\`.`;

export function getProposeTeamSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-propose-team',
    description: 'Propose a new change using a coordinated Agent Team of specialist roles that investigate in parallel and challenge each other before the lead writes the planning artifacts. Use for medium-to-hard changes where a single agent would miss perspectives or cannot hold a large codebase. Requires Claude Code Agent Teams.',
    instructions: PROPOSE_TEAM_BODY,
    license: 'MIT',
    compatibility: 'Requires openspec CLI and Claude Code Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxProposeTeamCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Propose (Team)',
    description: 'Propose a new change with a coordinated Agent Team of specialist roles (experimental; requires Agent Teams)',
    category: 'Workflow',
    tags: ['workflow', 'team', 'agents', 'experimental'],
    content: PROPOSE_TEAM_BODY,
  };
}
