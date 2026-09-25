# Product spec

This is a local-only, single-user personal job-search automation tool, not a SaaS product or a runtime AI service. Prefer small practical changes (YAGNI); authentication, cloud infrastructure, multi-user permissions, review bureaucracy, runtime LLM dependencies, and speculative abstractions are out of scope.

It is a Germany-focused, local, single-user personal job-search workflow. Discovery and filtering should optimize for jobs realistically relevant to a Germany-based candidate rather than global job-search coverage.

Codex Desktop is the external Agent/orchestrator for explicit evaluation and tailoring planning. The Next.js application itself remains independently runnable without an LLM inside its process.

The practical workflow is Search → Review → Tailor → Apply. Discovery performs provider discovery, filtering, normalization, canonicalization/deduplication, and SQLite ingestion, then stops at Review; it does not automatically score jobs. Automation states (`DISCOVERED`, `ANALYZED`, `MATERIAL_GENERATED`) remain separate from human review (`PENDING`, `INTERESTED`, `SKIPPED`) and manual application state (`READY_TO_APPLY`, `APPLIED`). Candidate facts must never be fabricated, and applications must never be auto-submitted.

The project-owned validated `JobAnalysis` is stored in SQLite `jobs.analysis_json`. Its 1–5 score is authoritative; legacy `jobs.score` remains compatibility-only until later UI migration. Candidate claims are allowed only through validated references to the factual project profile. Material generation requires a validated analysis/tailoring plan and remains a deliberate human-controlled action.

Career Ops supplies read-only evaluation, writing, and Germany/DACH policy, never operational state. SQLite remains the only canonical operational state.


V0.3 accepts ordinary role, location, work-model, language, age, and per-run-limit preferences. It may query Bundesagentur für Arbeit and bounded web results; third-party platforms are discovery signals only. It keeps reusable official-source knowledge locally, prefers an official careers/ATS URL when a shallow resolution finds one, and presents accepted jobs for human Review. Material generation remains a deliberate human action.


## V0.4 workflow

Bounded web discovery uses Bing HTML results because DuckDuckGo's HTML endpoint returned an anti-bot challenge in local validation; it remains a shallow discovery signal, not a platform scraper.

## V0.5 discovery quality

Explicit public Personio career-site URLs are supported alongside existing sources. For Germany-based searches, clear foreign-local structured locations are rejected; Germany, explicit EU/Europe/worldwide, mixed, and ambiguous locations remain for human Review. No visa, citizenship, geocoding, or global work-authorisation inference is performed. Role-family filtering is title-led and does not admit unrelated roles solely because a generic family term appears in their description.
