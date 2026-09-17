# Product spec

This is a local-only, single-user personal job-search automation tool, not a SaaS product and not an autonomous AI agent. Prefer small practical changes (YAGNI); authentication, cloud infrastructure, multi-user permissions, review bureaucracy, runtime LLM dependencies, and speculative abstractions are out of scope.

It is a Germany-focused, local, single-user personal job-search workflow. Discovery and filtering should optimize for jobs realistically relevant to a Germany-based candidate rather than global job-search coverage.

Codex or Claude Code may be used externally to maintain the repository, run commands, inspect results, or implement changes. The application itself must remain independently runnable as deterministic local software.

The practical workflow is Search → Review → Tailor → Apply. Automation states (`DISCOVERED`, `ANALYZED`, `MATERIAL_GENERATED`) remain separate from human review (`PENDING`, `INTERESTED`, `SKIPPED`) and manual application state (`READY_TO_APPLY`, `APPLIED`). Candidate facts must never be fabricated, and applications must never be auto-submitted.

V0.2 ranks and reorders only existing factual profile skills and experience bullets for each captured JD, while cover letters emphasize the top-ranked factual skills. No LLM, embeddings, external AI APIs, or provider credentials are used.


V0.3 accepts ordinary role, location, work-model, language, age, and per-run-limit preferences. It may query Bundesagentur für Arbeit and bounded web results; third-party platforms are discovery signals only. It keeps reusable official-source knowledge locally, prefers an official careers/ATS URL when a shallow resolution finds one, and stops after deterministic filtering, deduplication, and optional scoring for human review. Material generation remains a deliberate human action.


## V0.4 workflow

Bounded web discovery uses Bing HTML results because DuckDuckGo's HTML endpoint returned an anti-bot challenge in local validation; it remains a shallow discovery signal, not a platform scraper.

## V0.5 discovery quality

Explicit public Personio career sources are supported alongside existing sources. For Germany-based searches, only clear incompatible geography, foreign-residency, or work-authorisation requirements are rejected; compatible and ambiguous jobs remain for human Review. Role-family filtering is title-led and does not admit unrelated roles solely because a generic family term appears in their description.
