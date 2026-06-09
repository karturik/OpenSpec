## ADDED Requirements

### Requirement: Specialist roles available for Claude

When the `propose-team` workflow is enabled for the Claude tool, the system SHALL make the specialist roles available to the workflow with their intended capabilities, by installing role definition files into the Claude agents directory.

#### Scenario: Roles installed on opt-in

- **WHEN** a user applies an update with a profile that includes `propose-team` for the Claude tool
- **THEN** one role definition file per specialist role is written into the Claude agents directory and is usable as a teammate role

#### Scenario: Role files use platform-correct paths

- **WHEN** role definition files are written on Windows
- **THEN** their locations are composed with the platform path separator, with no hardcoded forward slashes

### Requirement: Scoped, non-disruptive installation

The specialist roles and the `propose-team` skill SHALL be generated only for the Claude tool and only when the workflow is opted into, leaving the default profile, other tools, and the user's editor settings unchanged.

#### Scenario: Default profile is unaffected

- **WHEN** a user applies an update with the default `core` profile
- **THEN** no specialist role files and no `propose-team` skill are generated

#### Scenario: User settings are not modified

- **WHEN** `propose-team` is installed or updated
- **THEN** the user's Claude settings file is not modified by OpenSpec as part of installation

### Requirement: Reversible installation

When the `propose-team` workflow is removed from the selection, the system SHALL remove the role definition files it manages and SHALL preserve any files it does not manage.

#### Scenario: Deselection removes managed files

- **WHEN** a previously installed `propose-team` workflow is deselected on a later update
- **THEN** the specialist role definition files that OpenSpec installed are removed

#### Scenario: Unmanaged files are preserved

- **WHEN** the Claude agents directory also contains files OpenSpec did not create
- **THEN** those files are left untouched when OpenSpec removes its managed role files
