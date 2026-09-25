# Architecture

Next.js App Router provides a local dashboard and route handlers. SQLite is the only canonical operational state, initialized through additive schema setup in `lib/db.ts`; existing files are never recreated or removed. The filesystem holds inspectable job folders and generated application materials.

`lib/discovery.ts` defines discovery adapters. Public Greenhouse, Lever, and explicitly configured Personio Company Career Site XML feeds record failures without bypassing blocks; one provider failure does not stop the others. Discovery performs provider discovery, filtering, normalization, canonicalization/deduplication, and ingestion, then stops at Review. It does not automatically score jobs.

Codex Desktop is the external Agent/orchestrator for explicit evaluation and tailoring planning. The project-owned validated `JobAnalysis` is stored in `jobs.analysis_json`; its 1–5 score is authoritative. Legacy `jobs.score` remains compatibility-only until a later UI migration. Candidate evidence is accepted only as validated references to the factual project profile, and material generation requires a validated tailoring plan.

Career Ops supplies read-only evaluation, writing, and Germany/DACH policy; it is never operational state. There is no runtime LLM dependency inside the Next.js process. Pipeline: discovery → filtering → normalization → canonicalization/deduplication → ingestion → Review → explicit Codex evaluation/tailoring plan → deliberate human-controlled materials → application tracking. Permanent IDs use the SQLite autoincrement identity and are never reused.
