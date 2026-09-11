# Architecture

Next.js App Router provides a local dashboard and route handlers. SQLite is the structured source of truth, initialized through additive schema setup in `lib/db.ts`; existing files are never recreated or removed. The filesystem holds inspectable job folders and future generated documents. `lib/discovery.ts` defines an adapter interface; V0.1 implements public Greenhouse and Lever JSON endpoints and records failures without bypassing blocks. Broad search and LLMs are optional provider seams configured only with environment variables.

Pipeline: discovery → normalization → deduplication → capture → analysis/scoring → material decision → human review. Permanent IDs use the SQLite autoincrement identity and are never reused.
