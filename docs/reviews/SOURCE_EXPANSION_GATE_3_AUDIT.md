# Discovery Source Expansion — Gate 3 Audit

## Status and scope

Gate 3 is ready for independent Control Room review. The audit ran on 2026-09-29 UTC on `feature/source-expansion` at base HEAD `3174f724c2365cf719bc95be925e4e592b6bdc72`, before this audit document was added. The Arbeitnow pass ran at approximately 05:09 UTC; the BA/Workable pass ran at `09:59:14Z`. No provider implementation or runtime configuration changed.

This was one bounded pass per source. The already-recorded Arbeitnow pass was retained rather than repeated. Bundesagentur and Workable were queried under the user's standing authorization. LinkedIn was not queried because its published terms restrict automated scraping; it is recorded as **NOT AUDITED — automation restriction**, not as zero-quality or a provider failure. No ATS provider was enabled. Generic Web Search remained disabled.

## Relevant configuration

| Source | Runtime setting | Audit behavior |
| --- | --- | --- |
| Bundesagentur für Arbeit | Enabled; source limit 6; 8 configured role queries; Germany-wide location; posting-age filter configured | 8 bounded GETs, one per role query; values are omitted from this artifact |
| Workable | Enabled; source limit 50 | Up to 3 pages total, sending only the configured role query and `location=Germany`; no posting-age parameter |
| Arbeitnow | Enabled; source limit 50 | Existing public-feed pass reused; no local search parameters |
| LinkedIn | Enabled in runtime config; limit 4 | Not audited; no automated requests |
| Generic Web Search | Disabled | Not queried |
| Configured ATS providers | 0 enabled | None applicable |

## Method and safety

The audit instantiated `discoverArbeitsagentur(...)` and `WorkableAdapter` directly, applied the existing `matchesPreferences()` function in memory, and compared accepted results with existing identities using a read-only SQLite connection. The database query read only `job_sources.url` and `jobs.external_id`, company, title, and location. It did not call `db()`, run migrations, or inspect profile or application state.

The audit did not call `runDiscovery()`, `ingest()`, or `recordSource()`. It did not write the real database or any profile, job, or application state. Actual configured query values were sent only to the authorized public source endpoints; no values were included in this artifact or the C2C evidence output. Full job descriptions were not retained.

## Measurements

Definitions: **accepted** means the existing canonical matcher returned true. Content status uses the provider's existing `SUBSTANTIVE` / `INSUFFICIENT` value. **Existing duplicate** means the current identity lookup matched a stored canonical URL, external ID, or lowercased company/title/location tuple. **Materially relevant unique** additionally requires a plausible target-role title, Germany-compatible result, substantive content, no existing identity, and no obvious noise in the inspected title/location sample.

| Source | Status | Requests / raw rows | Adapter normalized | Accepted / filtered | Accepted substantive / insufficient | Accepted existing duplicates | Materially relevant unique |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arbeitnow | AUDITED | 1 GET / 326 feed rows | 49 of 50 scanned | 3 / 46 | 3 / 0 | 0 | 3 |
| Bundesagentur für Arbeit | AUDITED | 8 GETs / 200 rows | 6 (source limit) | 3 / 3 | 0 / 3 | 3 | 0 |
| Workable | AUDITED | 3 GETs / 56 rows returned; 50-row scan cap | 42 | 2 / 40 | 2 / 0 | 0 | 2 |
| LinkedIn | NOT AUDITED — automation restriction | 0 | — | — | — | — | — |
| Configured ATS providers | Not applicable | 0 | — | — | — | — | — |

All 8 Bundesagentur responses were HTTP 200 with 25 `ergebnisliste` rows each. The observed JSON keys were `ergebnisliste`, `facetten`, `maxErgebnisse`, `page`, and `size`. Requests used the existing Germany-wide behavior and configured posting-age query field; no city/radius field was sent. The three accepted records were title-only under current content semantics and already existed with Bundesagentur as their sole source. They therefore add no new useful identities.

The Bundesagentur endpoint was `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs`.

The Arbeitnow request to `https://www.arbeitnow.com/api/job-board-api` was HTTP 200. Its first page contained 326 rows and advertised a next page; the adapter stopped after scanning its configured 50-row cap. Its 49 normalized records yielded 3 canonical matches, all substantive and unmatched in existing identities.

All three Workable requests were HTTP 200. Responses contained the expected `jobs` array and pagination fields. The first request returned 20 rows and a next token; the second used `pageToken`, returned 16 rows, and had no next token; the third began another role query, returned 20 rows, and still advertised a next token when the three-page bound was reached. Workable scanned no more than 50 raw records and normalized 42. Its two accepted records were substantive and had no existing identity match. The query parameter names were `query` and `location`, with `pageToken` on the continuation request; no posting-age field was present.

The Workable endpoint was `https://jobs.workable.com/api/v1/jobs`.

The broad Workable endpoint remains undocumented in Workable's published API material, as noted in the Gate 2 handoff. This pass confirms that its observed response still matches the adapter's current assumptions; it does not establish a support guarantee.

## Qualitative sample and overlap

All eight accepted records across the three audited sources were inspected by title, company, location, content status, and existing-identity result. No accepted title/location was obvious source noise. Description depth was assessed through the adapters' existing content-status semantics and character counts; descriptions were not retained in the handoff.

The five materially relevant unique candidates were:

- **Arbeitnow:** Senior Business Process Manager — gropyus, Berlin; Product Manager, Digital Wealth Management — Ginmon GmbH, Frankfurt; Senior Business Development Manager — Indra Avitech, Köln. All three were substantive and Germany-located.
- **Workable:** Senior Consultant / Cloud Transformation Manager — Infosys Consulting - Europe, Frankfurt am Main; SAP BRIM Functional Lead — Infosys Consulting - Europe, Munich. Both were substantive and Germany-located.

The three accepted Bundesagentur results were repeats of stored Bundesagentur identities, with no description content. No exact identity overlap appeared among the five new Arbeitnow/Workable candidates. Cross-source overlap with LinkedIn cannot be measured from this run because LinkedIn was intentionally not queried. No ATS overlap applies because none was configured. Older LinkedIn observations, if any, are not included in these fresh metrics.

## Limitations and Gate 4 evidence

The observed pool is bounded by the existing source caps: Arbeitnow scanned 50 of 326 first-page rows, and Workable stopped at its three-request limit while the final response still exposed another page token. These are audit bounds, not provider failures. Bundesagentur contributed no new substantive identities in this pass. LinkedIn has no fresh Gate 3 evidence.

The pass produced five distinct, substantive, Germany-compatible additions from Arbeitnow and Workable, across multiple role families and four employers. That is a practically useful candidate pool from one conservative pass; the evidence does not establish that another provider is needed. Therefore:

**GATE_4_CANDIDATE: NO**

This recommendation is limited to the measured source mix and one bounded pass. The Control Room should independently decide whether the resulting five unique candidates are adequate for the sprint's practical workflow and whether the unqueried LinkedIn limitation changes the next Gate. No JobSpy or other provider was implemented.

## Execution evidence and repository safety

The actual direct-adapter audit output is recorded in the existing C2C workspace evidence channel. The successful BA + Workable audit ran at `2026-09-29T09:59:14Z`; the prior Arbeitnow evidence remains recorded from the earlier Gate 3 pass. `npm run verify:core` passed: 147 tests across 17 files. `git diff --check` passed. No production source files changed.

`next-env.d.ts` remains the pre-existing unstaged edit and is not part of this checkpoint. `.DS_Store` remains untracked and is not included.
