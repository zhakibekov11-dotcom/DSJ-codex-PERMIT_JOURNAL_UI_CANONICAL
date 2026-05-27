# Start Here For Codex

## Before You Change Code, Read These Files First

- `README.md`
- `docs/context/current-product-status.md`
- `docs/context/repo-context-operating-system.md`
- `docs/context/execution-phases-p0-p4.md`
- the relevant area README: `apps/web/README.md`, `apps/api/README.md`, `packages/database/README.md`, or `apps/worker/README.md`
- the nearest area `AGENTS.md`
- `packages/database/prisma/schema.prisma`
- the matching feature card under `.mempalace/features/` when the task touches a named flow
- `CURRENT_FUNCTIONALITY.md` if you need a deeper audit snapshot

## Current Product Boundaries

- No new cabinets.
- No new auth roles unless the current ones cannot express the task.
- Director, safety engineer, and shop chief should stay as personas or capabilities inside the existing admin contour.
- Employee work stays in the self-service contour.
- The current focus is an operationally credible compliance flow, not broad platform sprawl.

## Current No-Go Zones

- No parallel signing or archive universes.
- Signed documents are immutable; changes after sign should go through annul, replace, or a new revision path.
- No broad org-model rewrite.
- No OCR / QR recognition project unless the task explicitly asks for it.
- No director approval workflow as a default bottleneck.
- No training / certificates detour into the main P2 start.

## Current Next Likely Module

- P2 start via online work permits core

## Working Order In A New Chat Or Branch

1. Open this file.
2. Open the relevant area README and nearest `AGENTS.md`.
3. Open the canonical files for the touched flow.
4. Open the matching MemPalace feature card if the task touches a P1 or P2 flow.
5. Change only the smallest files needed.
