# Changelog

## v0.6.2

- Updated Bundesagentur für Arbeit discovery to the working v6 Jobsuche endpoint and mapped its current response schema while preserving existing filtering, identity, and provider-error behavior.

## v0.6.1

- Rejected clear foreign structured locations such as “Anywhere in the United States” and explicit “currently authorized to work” requirements in Germany-focused discovery.
- Retried one transient Web-search transport failure and persisted nullable per-run upstream, filtered, and accepted candidate counts for new discovery runs.

## v0.6.0

- Added state-aware dashboard queues for review, tailoring, materials-ready, manual application, active applications, and historical jobs.
- Added read-only local access to existing generated resume, cover-letter, and application-package files from each job detail page.
- Preserved richer factual job-description text already available from bounded direct-careers/web resolution.

## v0.5.0

- Added deterministic discovery from explicitly configured public Personio career sources, including stable tenant/job identities and provider failure isolation.
- Hardened Germany-based filtering to reject only clear incompatible location, residency, or work-authorisation evidence.
- Made role-family filtering title-led so generic management and operations text in a job description does not independently qualify unrelated work.

## v0.4.0

- Consolidated the local workflow into Search → Review → Tailor → Apply with audited Interested/Skip decisions and manual application tracking.
- Added explicit primary working-language and additional-language preference fields.
- Added compact deterministic CV content selection and one-page ATS-safe CV rendering.
- Deferred Personio coverage, stricter Germany/authorization filtering, deterministic role relevance, and web-discovery reliability to V0.5.

## v0.2.0

- Added deterministic JD-based ordering of factual resume skills and experience bullets, plus tailored cover-letter skill emphasis.
- Removed unused external-provider environment placeholders.

## v0.1.0

- Initial local-first dashboard, SQLite state, discovery adapters, permanent IDs, deduplication, job captures, audit trail, and CSV/XLSX exports.
- Added deterministic job scoring with configurable thresholds and hard filters.
- Added factual-profile-based resume and cover-letter generation in DOCX/PDF, combined application packages, lightweight document QA, and separate material/application review states.
- Added automatic scoring after discovery and optional material generation for jobs above the configured threshold.
