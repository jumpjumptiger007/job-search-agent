# Repository guidance

This is a local-only, single-user personal job-search automation tool. It is not an autonomous AI agent. Keep changes small and practical (YAGNI): do not add SaaS complexity, authentication, cloud infrastructure, multi-user permissions, review bureaucracy, runtime LLM dependencies, or speculative abstractions without a concrete explicit requirement.

Codex and Claude Code are external development/operator tools only. They may edit this repository, run commands, inspect results, and automate maintenance workflows, but the application itself must remain independently runnable as deterministic local software.

Never auto-submit or click final application submission controls. Preserve human-owned decisions, never fabricate candidate facts, and keep all private candidate/job/runtime artifacts out of Git. The practical workflow is discover → deduplicate/canonicalize → score → tailor materials → human applies → track status. Schema evolution must be additive and migration-safe.

Repository YAML examples/defaults are reusable public configuration and must not be modified to encode one user's personal production setup during development or testing. Use local git-ignored YAML/profile/runtime files for real CV/profile data, job preferences, provider identifiers, or other user-specific production configuration. Only change committed YAML when the reusable project schema/default itself intentionally changes; real-profile acceptance testing must remain local and must not commit personal values.

Temporary test or acceptance data created by Codex or automation must be cleaned up after validation. Cleanup may delete only artifacts created by that specific test run; never delete real user profile/CV files, historical job data, production-generated materials, or other user-owned runtime data unless explicitly instructed. Keep all private/runtime data git-ignored and out of commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
