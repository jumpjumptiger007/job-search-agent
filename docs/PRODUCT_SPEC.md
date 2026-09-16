# Product spec

This is a local-only, single-user personal job-search tool, not a SaaS product. Prefer small practical changes (YAGNI); authentication, cloud infrastructure, multi-user permissions, review bureaucracy, and speculative abstractions are out of scope.

The practical workflow is discover → deduplicate/canonicalize → score → tailor materials → human applies → track status. V0.1 discovers public ATS listings, assigns immutable sequential job IDs after deterministic deduplication, captures original descriptions locally, and supports local review/export. Automation states (`DISCOVERED`, `ANALYZED`, `MATERIAL_GENERATED`) remain separate from human review (`MATERIAL_APPROVED`) and application state (`READY_TO_APPLY`, `APPLIED`). Candidate facts must never be fabricated, and applications must never be auto-submitted.

Stable baseline: `main` at `5a1c46c` (Greenhouse entity-decoding regression fix), with `npm test` (9/9), typecheck, lint, and build verified; known non-failing Turbopack filesystem-tracing warnings remain. The next major capability is real JD-based resume tailoring.
