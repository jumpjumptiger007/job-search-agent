## v0.4.0

- Consolidated the local workflow into Search → Review → Tailor → Apply with audited Interested/Skip decisions and manual application tracking.
- Added explicit primary working-language and additional-language preference fields.
- Added compact deterministic CV content selection and one-page ATS-safe CV rendering.
- Deferred Personio coverage, stricter Germany/authorization filtering, deterministic role relevance, and web-discovery reliability to V0.5.

# Changelog

## v0.2.0

- Added deterministic JD-based ordering of factual resume skills and experience bullets, plus tailored cover-letter skill emphasis.
- Removed unused external-provider environment placeholders.

## v0.1.0

- Initial local-first dashboard, SQLite state, discovery adapters, permanent IDs, deduplication, job captures, audit trail, and CSV/XLSX exports.
- Added deterministic job scoring with configurable thresholds and hard filters.
- Added factual-profile-based resume and cover-letter generation in DOCX/PDF, combined application packages, lightweight document QA, and separate material/application review states.
- Added automatic scoring after discovery and optional material generation for jobs above the configured threshold.
