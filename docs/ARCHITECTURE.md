# Architecture

Next.js App Router provides a local dashboard and route handlers. SQLite is the structured source of truth, initialized through additive schema setup in `lib/db.ts`; existing files are never recreated or removed. The filesystem holds inspectable job folders and generated application materials.

`lib/discovery.ts` defines discovery adapters. V0.1 implements public Greenhouse and Lever JSON endpoints and records failures without bypassing blocks. Scoring, filtering, deduplication, material selection, and state transitions are deterministic local code driven by local configuration and factual candidate data.

There is no runtime LLM or autonomous-agent layer. Codex or Claude Code may be used externally as development/operator tools, but the application itself must remain runnable without them.

Pipeline: discovery → normalization → deduplication → capture → analysis/scoring → material generation/selection → human review → application tracking. Permanent IDs use the SQLite autoincrement identity and are never reused.
