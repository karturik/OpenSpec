/**
 * Skill Template Workflow Module — verify-team
 *
 * Agent-Team variant of the solo verify workflow. The lead session coordinates a
 * panel of INDEPENDENT per-dimension verifiers (completeness, correctness,
 * coherence, + optional adversary) that investigate the same change in isolation
 * — never seeing each other's verdicts — so the lead can arbitrate their findings
 * into one Verification Report. Independence defeats single-agent anchoring.
 * Read-only: verify reports, it never edits. Claude-only, opt-in.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const VERIFY_TEAM_BODY = `Verify that an implementation matches its change artifacts using a coordinated **Agent Team** — one independent verifier per dimension investigates the SAME change in isolation, the lead arbitrates their findings and writes the single Verification Report.

**When to use:** medium-to-large or high-stakes changes where a single agent would anchor — once it "believes" the implementation is fine it rubber-stamps all three dimensions — or cannot hold a large diff in one context. The team's value is **independence**: separate verifiers that never see each other's verdicts defeat that confirmation bias. For small or local changes, use solo \`/opsx:verify\` instead.

**Prerequisite:** Claude Code Agent Teams must be enabled (\`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32). You are the **team lead and arbiter**: you collect the independent reports, reconcile conflicts, and you are the **only** agent that writes the consolidated report. **No agent — including you — edits the implementation. Verify reports; it does not fix.**

---

**Input:** an optional change name, and an optional tier: \`--tier=lite|standard|deep\` (default: \`standard\`).

## Step 0 — Preflight (you, the lead)

1. **Confirm Agent Teams is available.** Check the environment:
   \`\`\`bash
   echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
   \`\`\`
   If empty or the team tools are unavailable, STOP and tell the user to enable Agent Teams (\`export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32) or to run solo \`/opsx:verify\`. Never silently degrade.

2. **Select the change.** If no change name was given, run \`openspec list --json\` and use the **AskUserQuestion tool** to let the user choose. Show changes that have implementation tasks; mark changes with incomplete tasks as "(In Progress)". Do NOT guess or auto-select.

3. **Size the change → pick a tier.**
   - **small** (trivial/local, few tasks, single capability): do NOT form a team. Recommend solo \`/opsx:verify\` and stop.
   - **lite**: completeness-verifier + correctness-verifier. Coherence is skipped by default (record it as skipped per graceful degradation). You MAY assess coherence yourself only as an explicit exception — if you do, the report's Coherence row must be labeled non-independent (see Step 5).
   - **standard**: lite + coherence-verifier (coherence now independently verified).
   - **deep**: standard + adversary.
   Respect an explicit \`--tier\`. Otherwise infer it, then tell the user which tier you chose and how to override it.

4. **Load status and apply the scope guard FIRST:**
   \`\`\`bash
   openspec status --change "<name>" --json
   \`\`\`
   Parse it and keep \`schemaName\`, \`changeRoot\`, \`artifactPaths\`, and \`actionContext\`.

   If \`status\` reports \`actionContext.mode: "workspace-planning"\`, explain that full workspace implementation verification is not supported in this slice and STOP. Do not infer repo-local implementation ownership or edit linked repos. (Stop here — do not run the next command.)

5. **Load artifacts (only if not stopped):**
   \`\`\`bash
   openspec instructions apply --change "<name>" --json
   \`\`\`
   Keep the change directory and \`contextFiles\` (artifact ID -> concrete file paths). These are what you hand to verifiers — do not assume repo-local paths.

6. **Determine the artifact level (drives graceful degradation):** tasks-only → completeness only; tasks + specs → completeness + correctness; full artifacts (design present) → all three dimensions. Note up front which checks the available artifacts allow.

## Step 1 — Form the team

1. Create the team: \`TeamCreate(team_name: "opsx-verify-<name>", description: "Independent verification panel for <name>")\`.
2. Spawn one verifier per role in your tier with the **Agent tool** (\`team_name\`, a unique \`name\`, the role prompt). Give EVERY verifier this shared context in its spawn prompt:
   - the change name, \`changeRoot\`, and the relevant \`contextFiles\` entries from Step 0;
   - **"You are read-only. Do NOT write or edit ANY file — not artifacts, not the implementation. You verify; you never fix. Investigate the change independently and return ONLY your dimension's findings to the lead via SendMessage as CRITICAL / WARNING / SUGGESTION items, each with a specific recommendation and \`file:line\` references where applicable, plus your dimension's scorecard line. When uncertain, prefer SUGGESTION over WARNING, WARNING over CRITICAL."**
   - **"Investigate in ISOLATION. Do NOT message other verifiers and do NOT ask for their verdicts — independence is the point. Report only to the lead."**

   Then append the role-specific brief:

   - **completeness-verifier** — Read every file in \`contextFiles.tasks\` and parse checkboxes (\`- [ ]\` vs \`- [x]\`); count complete vs total. Each incomplete task -> CRITICAL ("Complete task: <desc>" or "Mark as done if already implemented"). If \`contextFiles.specs\` exist, extract every \`### Requirement:\` and search the codebase for evidence each is implemented; an unimplemented requirement -> CRITICAL ("Requirement not found: <name>"). Scorecard line: \`X/Y tasks, N reqs\`.
   - **correctness-verifier** — For each requirement in the delta specs, find implementation evidence (note \`file:line\`) and judge whether it matches the requirement's intent; divergence -> WARNING ("Implementation may diverge: <details>", "Review <file>:<lines> against requirement X"). For each \`#### Scenario:\`, check the condition is handled and a test covers it; uncovered -> WARNING ("Scenario not covered: <name>"). Scorecard line: \`M/N reqs covered\`.
   - **coherence-verifier** — If \`contextFiles.design\` exists, extract key decisions (sections like "Decision:", "Approach:", "Architecture:") and verify the implementation follows them; contradiction -> WARNING ("Design decision not followed: <decision>", "Update implementation or revise design.md to match reality"). Review new code for consistency with project patterns (naming, structure, style); significant deviation -> SUGGESTION. If no design.md, report "No design.md to verify against" and check patterns only. Scorecard line: \`Followed / Issues\`.
   - **adversary** (deep only) — Assume the change is subtly broken and the other verifiers will miss it. Independently hunt the one CRITICAL they overlooked: unhappy paths, security/permission/IO failures, concurrency, idempotency/re-run, cross-platform (Windows paths, case-sensitivity), and silently-skipped degradation checks. You do NOT see their reports either — you challenge by re-deriving, not by reacting. Surface any high-impact gap to the lead with concrete \`file:line\` evidence.

## Step 2 — Seed the shared task list

Create one task per verifier with **TaskCreate**, plus an arbitration task you own. The verifiers are mutually independent (NO \`blockedBy\` between them — parallelism preserves isolation); only your task waits on theirs:
- completeness-verifier (no deps); correctness-verifier (no deps); coherence-verifier (no deps); adversary (no deps);
- "arbitrate + write report" (owner: you; blockedBy all verifier tasks).

## Step 3 — Independent investigation (the point of the team)

Let the verifiers work in parallel and in isolation. Unlike a discovery team, there is **no peer debate here** — premature cross-talk is exactly the anchoring this design exists to prevent. Do not relay one verifier's verdict to another. Stay context-clean: rely on each returned digest, do not pull raw file dumps into your context. If a verifier's report is vague or missing \`file:line\` evidence, send THAT verifier targeted feedback (not the others) and wait for a revision.

## Step 4 — Arbitration (you, the arbiter)

Collect the independent reports and reconcile them — this is the work a single agent cannot do for itself:
- **Cross-examine conflicts.** Where dimensions disagree, resolve against the evidence: e.g. "completeness says task done, correctness says it diverges at \`file:line\` — reconcile." An all-green roster across every dimension is itself a flag: confirm each verifier cited concrete evidence rather than assuming.
- **De-dupe** the same underlying defect reported under two dimensions into one issue (keep the most actionable framing).
- **Apply the false-positive bias** when *you* are uncertain after weighing the evidence: prefer SUGGESTION > WARNING, WARNING > CRITICAL. BUT any verifier's CRITICAL that is backed by concrete \`file:line\` evidence stays CRITICAL — do not soften a substantiated finding.
- **Record skipped checks.** If the artifact level (Step 0.6) skipped a dimension, or a verifier could not verify something (e.g. no test harness), say so explicitly in the report.

## Step 5 — Single-author report (you only)

You are the only writer, and you write **only the report** — never the implementation. Synthesize the reconciled findings into the **exact format below** (identical to solo \`/opsx:verify\`):

**Summary Scorecard:**
\`\`\`
## Verification Report: <change-name>

### Summary
| Dimension    | Status           |
|--------------|------------------|
| Completeness | X/Y tasks, N reqs|
| Correctness  | M/N reqs covered |
| Coherence    | Followed/Issues  |
\`\`\`

If a dimension was skipped, write its status as \`Skipped (<reason>)\`. If you assessed Coherence yourself on lite rather than via an independent verifier, label that row non-independent — e.g. \`Followed (lead-assessed, non-independent)\` — so the report never reads an arbiter-authored dimension as an independent verdict.

**Issues by Priority:**

1. **CRITICAL** (Must fix before archive): incomplete tasks, missing requirement implementations — each with a specific, actionable recommendation.
2. **WARNING** (Should fix): spec/design divergences, missing scenario coverage — each with a specific recommendation.
3. **SUGGESTION** (Nice to fix): pattern inconsistencies, minor improvements — each with a specific recommendation.

**Final Assessment:**
- If CRITICAL issues: "X critical issue(s) found. Fix before archiving."
- If only warnings: "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."
- If all clear: "All checks passed. Ready for archive."

Use code references in \`file.ts:123\` format. No vague suggestions like "consider reviewing." Note which checks were skipped and why.

## Step 6 — Stand down

Shut down verifiers gracefully (SendMessage \`shutdown_request\`), then clean up the team. Deliver the report to the user. Because nothing was edited, point the user to the fixes the CRITICAL/WARNING items imply, then to \`/opsx:apply\` (to address them) or \`/opsx:archive\` (if clean).

## Tiers

| Tier | Roster (besides you) | Peer debate |
|------|----------------------|-------------|
| small | — (use solo \`/opsx:verify\`) | — |
| lite | completeness-verifier, correctness-verifier (coherence skipped/lead-assessed) | none (independent) |
| standard | + coherence-verifier | none (independent) |
| deep | + adversary | none (independent) |

## Guardrails

- **You write only the report.** No agent — you included — edits the implementation or the artifacts. Verify reports; it never fixes.
- **Independence over debate.** Verifiers investigate in isolation and never see each other's verdicts; the reconciliation happens at you, the arbiter. This is the deliberate opposite of the discovery team and is what defeats anchoring. If you assess a dimension yourself (lite coherence), label it non-independent in the report.
- **False-positive bias, evidence wins.** When uncertain, soften (SUGGESTION > WARNING > CRITICAL) — but never downgrade a CRITICAL backed by concrete \`file:line\` evidence.
- **Exact report format.** Output matches solo \`/opsx:verify\` precisely (3-dimension scorecard + CRITICAL/WARNING/SUGGESTION + final assessment).
- **Graceful degradation.** Verify only what the artifacts allow (tasks-only / tasks+specs / full) and state which checks were skipped.
- **Stay context-clean.** Coordinate on digests, not raw file dumps — that is how this scales to large diffs.
- **Right-size.** Don't form a team for trivial changes; redirect to solo \`/opsx:verify\`.
- **Experimental dependency.** If Agent Teams is unavailable, stop and offer solo \`/opsx:verify\`.`;

export function getVerifyTeamSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-verify-team',
    description: 'Verify an implementation against its change artifacts using a coordinated Agent Team of independent per-dimension verifiers (completeness, correctness, coherence) that investigate in isolation while the lead arbitrates their findings and writes the single Verification Report. Use for large or high-stakes changes where one agent would anchor and rubber-stamp. Requires Claude Code Agent Teams.',
    instructions: VERIFY_TEAM_BODY,
    license: 'MIT',
    compatibility: 'Requires openspec CLI and Claude Code Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxVerifyTeamCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Verify (Team)',
    description: 'Verify an implementation against its change artifacts with a coordinated Agent Team of independent verifiers that the lead arbitrates (experimental; requires Agent Teams)',
    category: 'Workflow',
    tags: ['workflow', 'team', 'agents', 'verify', 'experimental'],
    content: VERIFY_TEAM_BODY,
  };
}
