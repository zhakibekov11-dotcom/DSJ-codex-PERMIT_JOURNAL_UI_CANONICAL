---
name: document-pipeline-debug
description: Debug DSJ document-generation pipelines and binary export flows. Use when editing scripts/*.py, docx/xlsx generation, template replacement, or proxy routes that return generated files.
---

# Document Pipeline Debug

Debug document-generation flows without breaking the template contract.

## When to use

Use for:

- `scripts/*.py`
- `scripts/requirements-runtime.txt`
- `apps/api` endpoints that generate documents
- `apps/web/app/api/*` routes that proxy PDFs, DOCX, XLSX, or other binary output
- template files under `docs/experimental/*`

Do not use for unrelated Python or file I/O work.

## Inputs

- Script name
- Template path
- Sample JSON payload or form payload
- Output file type

## Procedure

1. Identify the exact contract: positional args, stdin JSON, output path, and template path.
2. Inspect the template or placeholder map before changing the script.
3. Keep output deterministic; avoid timestamps, random IDs, and machine-specific paths.
4. Preserve placeholder names and fail fast when the template contract drifts.
5. If dependencies changed, update `scripts/requirements-runtime.txt` and confirm the runtime install still covers them.
6. If a proxy route wraps the artifact, preserve status, headers, content type, and `Content-Disposition`.
7. Run the script on a sample payload and inspect the produced file.
8. Confirm that all placeholders are resolved and that the output opens cleanly.

## Required checks

- Run the script against a sample payload/template
- Inspect the generated artifact
- Verify any proxy route still returns the expected binary body and filename

## Outputs

- Generated artifact path
- Placeholder or template errors, if any
- Any dependency or font changes that need follow-up

## Red flags

- Hard-coded absolute paths
- Unresolved placeholders or marker drift
- Font substitutions or locale assumptions that change the output on another machine
- Non-deterministic output between repeated runs
- Proxy routes that stop forwarding binary content correctly
