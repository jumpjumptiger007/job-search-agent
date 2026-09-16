# Workflows

Discovery can be run manually from the dashboard, with `npm run discover`, or by a user-managed scheduler. Codex or Claude Code may also invoke these commands as external operator tools, but the application does not depend on either of them at runtime.

Configure enabled public boards in `config/search.yaml`. The dashboard remains useful when no discovery provider is configured.

Candidate setup is intentionally private. Without a factual profile and CV, document generation is blocked and audit-recorded rather than inventing content. Generated materials must be ATS-safe, versioned, extractable-text DOCX/PDF files stored in each job folder and QA-checked before becoming `READY`.

JD-based tailoring must remain deterministic and factual: it may select, prioritize, and reorder profile content according to the captured JD, but it must not invent candidate facts. No runtime LLM is required.

Human approval does not apply for a job. A person must explicitly set application tracking states, and the tool must never auto-submit an application.
