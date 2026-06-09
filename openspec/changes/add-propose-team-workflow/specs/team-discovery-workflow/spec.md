## ADDED Requirements

### Requirement: Opt-in team-based proposal

The `propose-team` workflow SHALL produce the same set of planning artifacts as the solo `propose` workflow (proposal, specs, design, tasks) using a coordinated team of specialist agents, and SHALL be available only when the user has enabled Claude Code Agent Teams.

#### Scenario: Team is available and runs

- **WHEN** the user starts `propose-team` with a change idea and Agent Teams is enabled
- **THEN** a lead coordinates a specialist team and the change ends with the planning artifacts required for implementation

#### Scenario: Agent Teams not enabled

- **WHEN** the user starts `propose-team` but Agent Teams is not enabled in their environment
- **THEN** the workflow stops before creating a team and tells the user how to enable Agent Teams or to use solo `/opsx:propose` instead

### Requirement: Conflict-free artifact authoring

The `propose-team` workflow SHALL produce planning artifacts without loss or corruption from concurrent contributions, so that no specialist's contribution silently overwrites another's.

#### Scenario: Many perspectives, one proposal

- **WHEN** several specialists contribute findings toward the proposal
- **THEN** the resulting `proposal.md` is internally coherent and reflects every contribution that was accepted, with no contribution lost to a concurrent write

#### Scenario: Specifications produced per capability

- **WHEN** specification files for different capabilities are produced in parallel
- **THEN** each specification file is authored without overwriting any other specification file

### Requirement: Adaptive sizing

The `propose-team` workflow SHALL match the number of specialist roles to the change's complexity, and SHALL redirect changes too small to benefit from a team to the solo workflow.

#### Scenario: Change too small for a team

- **WHEN** the change is trivial or local enough that a single agent is sufficient
- **THEN** `propose-team` declines to spawn a team and recommends running `/opsx:propose`

#### Scenario: Large or ambiguous change

- **WHEN** the user selects the deepest tier for a large or ambiguous change
- **THEN** the full specialist roster is engaged before artifacts are authored

### Requirement: Bounded convergence

Specialist teammates SHALL reconcile conflicting findings within a bounded amount of debate, after which any unresolved disagreement is recorded as an open question rather than continuing indefinitely.

#### Scenario: Specialists reach agreement

- **WHEN** the adversarial review reports no remaining blocking gaps
- **THEN** debate ends and the lead begins authoring artifacts

#### Scenario: Debate limit reached with open disagreements

- **WHEN** the bounded number of debate rounds is reached and disagreements remain
- **THEN** the remaining disagreements are written as open questions in `design.md` and the workflow proceeds to authoring

### Requirement: Validated before ready

The `propose-team` workflow SHALL NOT report a change as ready for implementation until its artifacts pass strict validation.

#### Scenario: Validation reports problems

- **WHEN** strict validation of the produced artifacts reports errors
- **THEN** the lead corrects the artifacts and re-validates before reporting completion

#### Scenario: Validation passes

- **WHEN** strict validation of the produced artifacts succeeds
- **THEN** the workflow reports the change as ready and points the user to `/opsx:apply`
