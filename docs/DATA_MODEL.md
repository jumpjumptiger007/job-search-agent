# Data model

`jobs` stores identity, canonical source, original JD, status, score, and user-owned priority/notes/application fields. `job_sources` retains all discovery URLs. `discovery_runs` records outcomes. `audit_events` records material state, source, and deduplication decisions. `duplicate_reviews` is reserved for uncertain matches.

Canonical-source preference favors official career/ATS URLs. Exact external ID, normalized company/title/location, and JD hash are safe automated merge signals. Lower-confidence semantic matches must create review work rather than silently merge.
