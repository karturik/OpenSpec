/**
 * Skill Template Workflow Module — explore-team
 *
 * Agent-Team variant of the solo explore workflow. The lead session coordinates
 * a panel of specialist teammates who investigate in parallel — mapping disjoint
 * areas of a codebase (cartography) or interrogating an idea from multiple
 * perspectives (elicitation) — and challenge each other before the lead
 * synthesizes one shared understanding. Explore is a stance: nothing is captured
 * unless the user asks, and nothing is ever implemented. Claude-only, opt-in.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

const EXPLORE_TEAM_BODY = `Explore a problem or a codebase using a coordinated **Agent Team** — specialist teammates investigate in parallel, challenge each other, and the lead synthesizes their findings into one shared understanding presented to you.

**Explore is a stance, not an artifact pipeline.** The deliverable is *understanding* — a synthesized map (ASCII diagrams welcome), comparison tables, surfaced risks, and open threads. There is NO \`openspec new change\`, no required outputs, no \`validate\`. You NEVER implement. You capture into OpenSpec artifacts ONLY if the user explicitly asks.

**When to use:** the exploration is too big or too contested for one agent — a large codebase a single context can't hold, or an idea that needs adversarial multi-perspective interrogation before it becomes a change. For small or local exploration, use solo \`/opsx:explore\` instead.

**Prerequisite:** Claude Code Agent Teams must be enabled (\`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32). You are the **team lead**: you coordinate the panel, you are the **only** agent that writes anything, and you only write if the user asks you to capture.

---

**Input:** what to explore (a topic, a problem, a subsystem, a comparison, or a change name for context), and an optional tier: \`--tier=lite|standard|deep\` (default: \`standard\`).

## Step 0 — Preflight (you, the lead)

1. **Confirm Agent Teams is available.** Check the environment:
   \`\`\`bash
   echo "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
   \`\`\`
   If empty or the team tools are unavailable, STOP and tell the user to enable Agent Teams (\`export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1\`, Claude Code >= v2.1.32) or to run solo \`/opsx:explore\`. Never silently degrade.

2. **Right-size — should this even be a team?**
   - **small** (a single file/function, a quick "how does X work", a two-option comparison you can hold in one head): do NOT form a team. Recommend solo \`/opsx:explore\` and stop.
   - Otherwise form a team and pick a mode + tier below.

3. **Pick the mode.** Explore-team serves two modes; choose the one that fits, or run both lenses if the exploration spans them:
   - **Cartography** — *"I need to understand this codebase / subsystem."* Parallel recon teammates each own a disjoint area; the lead synthesizes one architecture / data-flow / integration / conventions / risk map. This is how the team holds a codebase no single context could.
   - **Elicitation** — *"I have an idea; pressure-test it before it's a change."* Multi-perspective interrogation: a happy-path advocate, an edge/risk advocate, a business/JTBD + metrics lens, and an options/tradeoffs analyst challenge each other. (This is customer-discovery for a change, not a proposal.)
   If unsure which mode, use the **AskUserQuestion tool**.

4. **Pick the tier** (see Tiers table). Respect an explicit \`--tier\`. Otherwise infer it, then tell the user which mode + tier you chose and how to override.

5. **Derive a team slug.** Make a short kebab-case \`<slug>\` from the topic (e.g. "the auth system is a mess" -> \`auth-system\`, "postgres vs sqlite for the CLI" -> \`postgres-vs-sqlite\`). You will use it for the team name in Step 1.

6. **Gather context only (do NOT scaffold a change).**
   \`\`\`bash
   openspec list --json
   \`\`\`
   If the user named a change, read it for context only:
   \`\`\`bash
   openspec status --change "<name>" --json
   \`\`\`
   Use \`changeRoot\`, \`artifactPaths\`, and \`actionContext\` to locate existing artifacts; read from \`artifactPaths.<artifact>.existingOutputPaths\`. This is grounding, not a commitment to write anything.

## Step 1 — Form the team

1. Create the team: \`TeamCreate(team_name: "opsx-explore-<slug>", description: "Exploration panel for <topic>")\`.
2. Spawn one teammate per role in your mode + tier with the **Agent tool** (\`team_name\`, a unique \`name\`, the role prompt). Give EVERY teammate this shared context in its spawn prompt:
   - the exploration topic and the chosen mode;
   - the repo root and any change paths from Step 0 (for grounding);
   - **"You are read-only. Do NOT write or edit any file and do NOT implement anything. Investigate, then send the lead a distilled digest (<=8 bullets, with file:line references where relevant) via SendMessage. Challenge other teammates by name when you disagree."**

   Then append the role-specific brief.

   **Cartography roster:**
   - **cartographer** — Own ONE disjoint area of the codebase (the lead assigns the boundary — e.g. "the auth subsystem", "the data layer", "the CLI command surface"). Map its structure, key files, entry/exit points, the patterns it uses, and how it connects outward. Return a digest the lead can stitch into a whole-system map. For a large codebase, the lead spawns several cartographers over non-overlapping areas.
   - **integration-tracer** — Follow the seams *between* areas: data flow, call graphs, shared state, public interfaces, and where the cartographers' areas touch. Surface coupling and hidden dependencies the per-area maps miss.
   - **risk-scout** — Hunt complexity and danger: fragile spots, missing tests, concurrency/IO/cross-platform hazards, load-bearing assumptions, and unknowns worth a spike. Challenge any cartographer who reports an area as "clean."

   **Elicitation roster:**
   - **happy-path** — Articulate the primary success story: the job-to-be-done done well, the ideal user flow, what "it works" looks like. Own the optimistic case.
   - **edge-adversary** — Attack it: empty/invalid/huge inputs, concurrency, partial failure, idempotency, permissions/IO, cross-platform. Surface the unhappy paths the happy-path story glosses. Challenge happy-path by name.
   - **business-lens** — Own the Why: who it serves, why now, the JTBD, and 1-2 measurable success metrics plus a guardrail metric. Challenge any direction that doesn't move a metric.
   - **options-analyst** — Enumerate the real alternatives (including "do nothing"), build the tradeoff table, name the load-bearing decision, and recommend a path *with* its costs. Red-team every other lens.

## Step 2 — Seed the shared task list

Create one task per role with **TaskCreate**, plus a synthesis task you own. Use \`blockedBy\` so synthesis waits on the panel.
- **Cartography:** each cartographer (no deps); integration-tracer (blockedBy the cartographers); risk-scout (blockedBy cartographers); "synthesize the map" (owner: you; blockedBy all).
- **Elicitation:** happy-path, business-lens (no deps); edge-adversary (blockedBy happy-path); options-analyst (blockedBy the above); "synthesize the findings" (owner: you; blockedBy all).

## Step 3 — Bounded debate (the point of the team)

Let teammates work and message each other. Drive a **bounded** challenge:
- the adversarial roles (risk-scout / edge-adversary, options-analyst) must each file at least one concrete, addressed objection (e.g. "@happy-path: your sync flow has no offline scenario — what happens?").
- **Hard cap: 2 challenge rounds** (1 on the lite tier). Do not loop further. Any disagreement still open after the cap becomes a **surfaced open thread** in your synthesis — undecided is a valid, valuable outcome, not a blocker.
- You count the rounds; teammates do not. Stay context-clean: rely on their digests, do NOT pull raw file dumps into your context. This is exactly how the team scales to a large codebase.

## Step 4 — Synthesis-readiness gate (you)

Before you synthesize, confirm:
- **Cartography:** every assigned area has a returned digest; if the tier staffs integration-tracer, confirm it connected the areas (no orphan islands); if the tier staffs risk-scout, confirm it named concrete hazards with file:line, not "looks fine."
- **Elicitation:** both the optimistic and adversarial cases are present (no all-green roster); business-lens produced at least one metric; if the tier staffs options-analyst, confirm a real tradeoff table.
If a gap remains, send the owning teammate targeted feedback and wait for a revision.

## Step 5 — Synthesis: build the understanding (you only)

You are the synthesizer. Consolidate the teammate digests into ONE coherent understanding and present it to the user — **do not write files unless asked.** Favor:
- a synthesized **map** stitched from the cartographers (ASCII architecture / data-flow / dependency diagrams — use them liberally);
- **comparison / tradeoff tables** from options-analyst and business-lens;
- **surfaced risks** from risk-scout / edge-adversary;
- **open threads** — the unresolved debates from Step 3, named honestly as questions, not buried.

A useful shape:
\`\`\`
## What We Found

**The shape of it**: <synthesized map / architecture — diagram welcome>

**Key tradeoffs**: <table, if elicitation>

**Risks & unknowns**: <from the adversaries>

**Open threads**: <unresolved debates — for the user to decide>

**If you want to go further**:
- Capture this into a change (I can run /opsx:propose or /opsx:propose-team)
- Keep exploring a specific thread
\`\`\`
This summary is a service to the user, not a required artifact. Sometimes the synthesized understanding IS the whole value.

## Step 6 — Capture only if asked (you only)

Explore does NOT auto-capture. If — and only if — the user asks to persist something, you (the lead, the only writer) capture it into the right OpenSpec artifact, mapping insight -> destination:

| Insight type               | Where to capture               |
|----------------------------|--------------------------------|
| New requirement discovered | \`specs/<capability>/spec.md\`   |
| Design decision made       | \`design.md\`                    |
| Scope changed              | \`proposal.md\`                  |
| New work identified        | \`tasks.md\`                     |

Offer, then move on. Do NOT pressure, do NOT implement application code. If the user wants to formalize the whole thing, point them to \`/opsx:propose\` (or \`/opsx:propose-team\` for a big one) rather than hand-building the change here.

## Step 7 — Stand down

Shut down teammates gracefully (SendMessage \`shutdown_request\`), then clean up the team. Report: what was explored, the mode + tier used, the synthesized understanding, the open threads, and anything captured (only if the user asked). Offer the natural next step — keep exploring, or move to \`/opsx:propose\`.

## Tiers

| Tier  | Cartography roster (besides you)            | Elicitation roster (besides you)                  | Debate rounds |
|-------|---------------------------------------------|---------------------------------------------------|---------------|
| small | — (use solo \`/opsx:explore\`)                | — (use solo \`/opsx:explore\`)                      | —             |
| lite  | 2 cartographers (or cartographer + risk-scout) | happy-path + edge-adversary                    | 1             |
| standard | + integration-tracer + risk-scout        | + business-lens                                   | 2             |
| deep  | several cartographers over subsystems + integration-tracer + risk-scout | + options-analyst       | 2             |

## Guardrails

- **Understanding, not artifacts.** The deliverable is a synthesized map / tradeoffs / risks / open threads presented to the user. No \`openspec new change\`, no \`validate\`, no required files.
- **Never implement.** Explore is for thinking. Teammates and lead read, map, and reason — they never write application code.
- **Don't auto-capture.** Persist into OpenSpec artifacts only if the user explicitly asks; the lead is the only writer.
- **You are the only writer.** Teammates are strictly read-only; they return digests, you synthesize.
- **Bounded debate.** At most 2 rounds (1 on lite); unresolved items become surfaced open threads, not another round.
- **Stay context-clean.** Coordinate on digests, never raw file dumps — that is how this scales to a codebase one context can't hold.
- **Right-size.** Don't form a team for a small/local question; redirect to solo \`/opsx:explore\`.
- **Experimental dependency.** If Agent Teams is unavailable, stop and offer solo \`/opsx:explore\`.`;

export function getExploreTeamSkillTemplate(): SkillTemplate {
  return {
    name: 'openspec-explore-team',
    description: 'Explore a problem or a large codebase using a coordinated Agent Team — specialist teammates map disjoint areas or interrogate an idea from multiple perspectives in parallel, challenge each other, and the lead synthesizes one shared understanding (maps, tradeoffs, risks, open threads) without auto-capturing or implementing. Requires Claude Code Agent Teams.',
    instructions: EXPLORE_TEAM_BODY,
    license: 'MIT',
    compatibility: 'Requires openspec CLI and Claude Code Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

export function getOpsxExploreTeamCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Explore (Team)',
    description: 'Explore a problem or codebase with a coordinated Agent Team — parallel cartography or multi-perspective elicitation, synthesized by the lead (experimental; requires Agent Teams)',
    category: 'Workflow',
    tags: ['workflow', 'team', 'agents', 'explore', 'thinking', 'experimental'],
    content: EXPLORE_TEAM_BODY,
  };
}
