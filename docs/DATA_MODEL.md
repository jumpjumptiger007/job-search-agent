# Data model

`jobs` stores identity, canonical source, original JD, status, and user-owned priority/notes/application fields. The canonical 1–5 evaluation score is `jobs.analysis_json.evaluation.score`; legacy `jobs.score` and `score_explanation` are compatibility-only historical fields and are not user-facing. `job_sources` retains all discovery URLs. `discovery_runs` records outcomes. `audit_events` records material state, source, and deduplication decisions. `duplicate_reviews` is reserved for uncertain matches. SQLite is the sole canonical operational state.

Canonical-source preference favors official career/ATS URLs. Exact external ID, normalized company/title/location, and JD hash are safe automated merge signals. Lower-confidence fuzzy or heuristic matches must create review work rather than silently merge.
