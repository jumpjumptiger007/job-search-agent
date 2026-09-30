# Project Guidance

## Product and workflow

- This is a local-first, single-user, Germany-focused job-search tool. Electron is a shell around the existing Next.js Dashboard; the app has no runtime LLM. Keep changes practical and do not add cloud, SaaS, authentication, multi-user behavior, or another agent runtime without an explicit requirement.
- The workflow is discovery → normalization and deduplication → human review → explicit evaluation and tailoring → deliberate materials generation → human application and tracking. Discovery ends at Review and does not score jobs automatically. Never auto-submit or click final application submission controls, invent candidate facts, or silently change human-owned decisions.
- Follow the approved scope and acceptance criteria. Surface genuine workflow, data, migration, privacy, or release decisions rather than expanding scope.

## Data and integration boundaries

- SQLite is the only canonical operational state. Preserve permanent `JOB-xxxx` IDs, canonical-source and source-ownership behavior, source URLs, and audit history. Keep permanent Job IDs distinct from SQLite row IDs. Uncertain duplicate matches must be reviewed rather than silently merged.
- Job folders hold generated or user application artifacts; they must not mirror SQLite job metadata, captured job descriptions, or analysis.
- Career Ops may provide upstream policy, workflows, evaluation, writing, and provider capabilities, but is not a state store. Integrate through this repository's boundary; do not modify pinned or vendored upstream code or add another canonical tracker or database.
- Keep schema changes additive and migration-safe. Candidate claims must be supported by the factual project profile. Treat validated analysis and tailoring plans as prerequisites for materials generation.
- Within each job's artifact folder, treat `resume/rendercv.yaml` and `resume/resume.pdf` as generated outputs; change their generating workflow rather than editing generated output when behavior needs to change.

## Private data and configuration

- Keep private profile/CV data, personal configuration, SQLite databases, `jobs/JOB-*`, generated materials, exports, logs, and `.env` out of Git. Honor existing ignore exceptions such as `profile/README.md` and `exports/.gitkeep`.
- Tracked `*.example.yaml` files are reusable public defaults. Do not put personal production values in them; use the corresponding git-ignored local configuration files.
- Do not overwrite real profiles, historical job data, databases, or generated materials. Remove temporary test or acceptance artifacts only when that run created them.

## Development and validation

- Read the relevant parts of `README.md` and `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, or `docs/WORKFLOWS.md` before changing the areas they describe. Update those documents when durable behavior changes instead of duplicating their details here.
- Use the repository's npm scripts. Run focused validation for the changed area; `npm run verify` runs the full test, typecheck, lint, and build checks. Use `npm run db:migrate` for database migrations.
- Repository skills under `.agents/skills/` provide task-specific workflows. Use them only when the task matches their purpose, and keep this repository's product, data, privacy, and state boundaries authoritative. In particular, `job-agent` owns the selected-job evaluation/tailoring workflow; `linkedin-search` is the pinned specialist used by the existing LinkedIn integration, not a separate state or workflow owner.

## Release and handoff

- For feature or release work being prepared for integration, keep `main` unchanged on a dedicated branch until the required independent review is complete. Use `docs/reviews/` for version, gate, or release handoffs when that work has a formal review/release boundary; include scope, validation, limitations, data/Git safety, and review status. Routine documentation fixes or isolated maintenance changes do not require a release handoff unless the task explicitly calls for one.
- For feature/release gates, run the required C2C independent review only after the implementation and fresh validation evidence exist. C2C should inspect the connected workspace and relevant diff/evidence rather than relying only on the implementer's summary. Fix in-scope findings and revalidate before integration. If required review cannot complete, report it as incomplete and do not claim independent review.
- Do not merge, tag, publish, or create a release before the required review is complete and the human integration/release decision has been given. Routine changes that are explicitly authorized for direct commit/push are not automatically converted into a release workflow.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
