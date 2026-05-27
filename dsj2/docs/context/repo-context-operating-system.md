# Repo Context Operating System

Repo Context Operating System (RCOS) is the repository-level operating model for DSJ.

It is the context layer that keeps agents, docs, branch phases, and area instructions aligned before code changes.
It is not product logic.

## Layers

- AGENTS routing layer: decide which local instructions apply to the touched files.
- MemPalace context memory layer: `.mempalace/*` stores machine-readable repo, branch, and feature routing.
- split README layer: area README files give local orientation for each package or app.
- docs/context navigation layer: human-readable start-here, status, and phase docs.
- branch execution layer P0-P4: phase markers for what is in scope now versus later.

## How To Use It

1. Open `docs/context/start-here-for-codex.md`.
2. Open the current status snapshot.
3. Open the relevant area README and nearest `AGENTS.md`.
4. Open the canonical files for the touched flow.
5. Only then change code.

## Guardrail

If code, package scripts, and docs disagree, code and package scripts win.
