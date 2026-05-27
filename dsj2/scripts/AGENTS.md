# Script Area Rules

This file augments `../../AGENTS.md`.

Use it for Python document-generation helpers and other file-producing scripts under `scripts/`.

## Rules

- Treat the CLI contract as stable: args, stdin JSON, template paths, and output path layout.
- Keep outputs deterministic; do not add timestamps, random IDs, or machine-specific paths unless required.
- Preserve placeholder names and template markers; fail fast if the template contract drifts.
- Use repo-relative paths and explicit output locations.
- Keep dependencies in `scripts/requirements-runtime.txt` in sync with runtime needs.
- Current helpers include the `generate_*`, `export_*`, and `normalize_*` document scripts.

## Validation

- Run the script on a sample payload/template and inspect the generated artifact.
- If dependencies change, verify the runtime install still covers them.
- If a route proxies the generated file, confirm the proxy preserves headers and the binary body.

## Escalate

- Hard-coded absolute paths.
- Unresolved placeholders or template marker drift.
- Non-deterministic output that changes between runs without an input change.
- Font, locale, or template assumptions that make the output dependent on a specific machine.
