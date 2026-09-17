# Architecture

Next.js App Router provides a local dashboard and route handlers. SQLite is the structured source of truth, initialized through additive schema setup in `lib/db.ts`; existing files are never recreated or removed. The filesystem holds inspectable job folders and generated application materials. V0.2 ranks existing factual profile skills and experience bullets against each captured JD before material generation.

`lib/discovery.ts` defines discovery adapters. Public Greenhouse, Lever, and explicitly configured Personio Company Career Site XML feeds record failures without bypassing blocks; one provider failure does not stop the others. Scoring, filtering, deduplication, material selection, and state transitions are deterministic local code driven by local configuration and factual candidate data.

There is no runtime LLM or autonomous-agent layer. Codex or Claude Code may be used externally as development/operator tools, but the application itself must remain runnable without them.

Pipeline: discovery → normalization → deduplication → capture → analysis/scoring → material generation/selection → human review → application tracking. Permanent IDs use the SQLite autoincrement identity and are never reused.
