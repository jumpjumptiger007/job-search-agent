# Workflows

Discovery can be run manually from the dashboard, with `npm run discover`, or by a user-managed scheduler. Codex or Claude Code may also invoke these commands as external operator tools, but the application does not depend on either of them at runtime.

Configure ordinary private preferences in `config/preferences.yaml`; configure only the enabled bounded discovery routes in `config/search.yaml`. Known Greenhouse/Lever boards remain optional advanced sources. Discovery stops at filtering, canonicalization, deduplication, and optional deterministic scoring; a person chooses Interested or Skip and explicitly generates materials.

Candidate setup is intentionally private. Without a factual profile and CV, document generation is blocked and audit-recorded rather than inventing content. Generated materials must be ATS-safe, versioned, extractable-text DOCX/PDF files stored in each job folder and QA-checked before becoming `READY`.

JD-based tailoring must remain deterministic and factual: it may select, prioritize, and reorder profile content according to the captured JD, but it must not invent candidate facts. No runtime LLM is required.

Temporary test or acceptance data created by Codex or automation must be cleaned up after validation. Cleanup may delete only artifacts created by that specific test run; never delete real user profile/CV files, historical job data, production-generated materials, or other user-owned runtime data unless explicitly instructed. Keep all private/runtime data git-ignored and out of commits.

Human approval does not apply for a job. A person must explicitly set application tracking states, and the tool must never auto-submit an application.
