# Repository guidance

This is a local-only, single-user personal job-search tool. Keep changes small and practical (YAGNI): do not add SaaS complexity, authentication, cloud infrastructure, multi-user permissions, review bureaucracy, or speculative abstractions without a concrete need.

Never auto-submit or click final application submission controls. Preserve human-owned decisions, never fabricate candidate facts, and keep all private candidate/job/runtime artifacts out of Git. The practical workflow is discover → deduplicate/canonicalize → score → tailor materials → human applies → track status. Schema evolution must be additive and migration-safe.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
