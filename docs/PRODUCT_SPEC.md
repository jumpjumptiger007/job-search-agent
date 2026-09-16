# Product spec

This is a local-only, single-user personal job-search automation tool, not a SaaS product and not an autonomous AI agent. Prefer small practical changes (YAGNI); authentication, cloud infrastructure, multi-user permissions, review bureaucracy, runtime LLM dependencies, and speculative abstractions are out of scope.

Codex or Claude Code may be used externally to maintain the repository, run commands, inspect results, or implement changes. The application itself must remain independently runnable as deterministic local software.

The practical workflow is discover → deduplicate/canonicalize → score → tailor materials → human applies → track status. V0.1 discovers public ATS listings, assigns immutable sequential job IDs after deterministic deduplication, captures original descriptions locally, and supports local review/export. Automation states (`DISCOVERED`, `ANALYZED`, `MATERIAL_GENERATED`) remain separate from human review (`MATERIAL_APPROVED`) and application state (`READY_TO_APPLY`, `APPLIED`). Candidate facts must never be fabricated, and applications must never be auto-submitted.

V0.2 ranks and reorders only existing factual profile skills and experience bullets for each captured JD, while cover letters emphasize the top-ranked factual skills. No LLM, embeddings, external AI APIs, or provider credentials are used.
