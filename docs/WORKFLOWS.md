# Workflows

Discovery is run manually from the dashboard or with `npm run discover`; a scheduler can call that command. Configure enabled public boards in `config/search.yaml`. The dashboard remains useful when no provider is configured.

Candidate setup is intentionally private. Without a factual profile and CV, document generation is blocked and audit-recorded rather than inventing content. When implemented with a configured profile, document output must be ATS-safe, versioned, extractable-text DOCX/PDF files stored in each job folder and QA-checked before becoming `READY`.

Human approval does not apply for a job. A person must explicitly set application tracking states.
