# Repository guidance

This is a local-only, single-user personal job-search automation tool. It is not an autonomous AI agent. Keep changes small and practical (YAGNI): do not add SaaS complexity, authentication, cloud infrastructure, multi-user permissions, review bureaucracy, runtime LLM dependencies, or speculative abstractions without a concrete explicit requirement.

This is a Germany-focused, local, single-user personal job-search workflow. Discovery and filtering decisions should optimize for jobs realistically relevant to a Germany-based candidate, not a global job-search engine.

Codex and Claude Code are external development/operator tools only. They may edit this repository, run commands, inspect results, and automate maintenance workflows, but the application itself must remain independently runnable as deterministic local software.

Never auto-submit or click final application submission controls. Preserve human-owned decisions, never fabricate candidate facts, and keep all private candidate/job/runtime artifacts out of Git. The practical workflow is discover → deduplicate/canonicalize → score → tailor materials → human applies → track status. Schema evolution must be additive and migration-safe.

Repository YAML examples/defaults are reusable public configuration and must not be modified to encode one user's personal production setup during development or testing. Use local git-ignored YAML/profile/runtime files for real CV/profile data, job preferences, provider identifiers, or other user-specific production configuration. Only change committed YAML when the reusable project schema/default itself intentionally changes; real-profile acceptance testing must remain local and must not commit personal values.

Temporary test or acceptance data created by Codex or automation must be cleaned up after validation. Cleanup may delete only artifacts created by that specific test run; never delete real user profile/CV files, historical job data, production-generated materials, or other user-owned runtime data unless explicitly instructed. Keep all private/runtime data git-ignored and out of commits.

## Release / Handoff Workflow

Develop each feature release on a dedicated feature branch; keep `main` unchanged until independent review is complete. After implementation and validation, create `docs/reviews/<VERSION>_HANDOFF.md` recording the baseline version/commit, implementation branch, final implementation commit, delivered scope, validation/test results, production-style verification where applicable, known limitations, deferred items, private-data/Git safety status, and readiness for independent review. Commit the handoff with the completed implementation on the feature branch. Do not merge, tag, or release until independent review is complete.

## Development collaboration

Manual ChatGPT is the product-planning layer: settle whether a version is justified, its scope/non-goals, acceptance criteria, and product/workflow tradeoffs before implementation. Codex is the execution layer: inspect the actual workspace and Git state, implement approved scope, test, validate, run production verification when requested, maintain branch/commit hygiene, and provide evidence-based handoff. It must surface genuine product, migration, private-data, scope, or release decisions rather than silently inventing or expanding them.

`codex-with-chatgpt` (C2C) is an independent reasoning and review layer, not a substitute for Codex's execution ownership. Use it where independent reasoning materially improves confidence—implementation review, scope/acceptance checks, ambiguous decisions, defect classification, production-evidence interpretation, and final pre-release review—not mechanically for routine edits, formatting, or ordinary tests. For release verification and final release review, Codex must invoke C2C after relevant implementation/test/production evidence exists; the reviewer must inspect the connected workspace and evidence itself, and the handoff must say whether review completed. If mandatory C2C review cannot complete, Codex must report that clearly and must not present the result as independently reviewed.

The normal version flow is Manual ChatGPT → product scope/acceptance criteria → Codex implementation/tests/production evidence → C2C independent review → Codex handoff → human merge/release decision. Real post-release usage, not speculative work, drives the next planning cycle.

For applicable Codex development workflows, use the available Ponytail skill and keep the solution minimal; do not claim it was used unless it was actually invoked.

Before final handoff or release review, mandatory C2C review must inspect the actual workspace, the actual implementation-branch diff, and fresh validation evidence itself, rather than relying only on the implementer's summary. In-scope defects found by C2C must be fixed and revalidated before handoff. If C2C is unavailable, do not fabricate an independent review; report that it is incomplete.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
