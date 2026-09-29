# Discovery Source Expansion — Gate 2 Handoff

## Status

**PARTIAL — implementation is committed; the required adapter live smoke is blocked.** Do not close Gate 2 or begin Gate 3 until the live smoke is authorized, completed, and independently reviewed.

## Baseline and implementation

- Package baseline: `0.9.1`; the next release version was not assigned in the approved sprint scope.
- Main baseline: `c7e3dd7165db22603e0b7cd9c5802fce88a22402`.
- Reviewed Gate 1 checkpoint: `4bf1e641eed26d5f756a7ae0abb453c2203e48ef`.
- Implementation branch: `feature/source-expansion`.
- Gate 2 implementation commit: `6d106edf84effa710c22cb1c1dbe6c64de1d4e80` (`feat(discovery): add Workable source`).
- Handoff record is committed separately after the implementation checkpoint so it can identify the implementation commit.
- No push, merge, tag, or release was performed.

## Delivered scope

- Added a native `WorkableAdapter` using the public Workable Jobs search endpoint, with injected fetch, existing role-family and location preferences, a 50-record default cap, and a three-page maximum.
- Normalizes stable Workable IDs (or canonical public URL fallback), company, title, explicit location, direct HTTPS job URL, HTML description, valid creation date, and explicit workplace type.
- Wires the adapter into the existing `runDiscovery()` provider loop and failure isolation. Canonical preference matching and ingestion/deduplication remain unchanged.
- Added disabled-by-default reusable example configuration and nine deterministic tests in `verify:core`.
- The ignored local `config/search.yaml` enables Workable at limit 50 after the earlier successful public-endpoint preflight. That private runtime configuration is not committed.

## Endpoint evidence and limits

An earlier minimal unauthenticated preflight in this Gate observed `GET https://jobs.workable.com/api/v1/jobs?query=software+engineer&location=Germany` returning HTTP 200 JSON. The observed top-level fields were `title`, `totalSize`, `nextPageToken`, `jobs`, and `autoAppliedFilters`; the response contained 20 individual jobs per page and continued with the `pageToken` query parameter. Records included a UUID `id`, title, company, location, direct `jobs.workable.com/view/...` URL, HTML description and requirements/benefits sections, `created`, and explicit `workplace` values. This established a bounded three-page scan for the configured default cap of 50.

Workable's published account API and help material describe account-scoped job access; the broad public search endpoint used here is not documented there. This endpoint is therefore a maintenance risk and must be rechecked during the live smoke and monitored for response-shape changes. See [Workable API jobs endpoint](https://workable.readme.io/reference/jobs) and [Workable Help: careers page API](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page).

## Validation

- `npm test -- tests/workable-discovery.test.ts` — passed, 9/9.
- `npm run verify:core` — passed, 147 tests across 17 files.
- `npm run typecheck` — passed in a temporary Git-archive copy with the full Gate 2 overlay, preserving the local `next-env.d.ts` change. An earlier temporary-copy attempt failed because its overlay omitted the changed `lib/discovery.ts`; the corrected full overlay passed.
- `npm run lint` — passed with 0 errors and one pre-existing warning at `app/discovery-actions.tsx:46`.
- Adapter live smoke — **UNVERIFIED / BLOCKED**. The direct adapter harness started, but the local shell could not resolve `jobs.workable.com` (`ENOTFOUND`). The network escalation was rejected by automatic approval review because it would transmit locally configured role-family preferences and location to the external endpoint without specific authorization. No successful adapter request, normalized live result, or in-memory preference-match count is claimed here.

## Data and Git safety

- The attempted live smoke used only the adapter directly. It did not call `runDiscovery()`, `ingest()`, or `recordSource()`, and did not write to SQLite or candidate/profile/application state.
- Deterministic ingestion tests used isolated temporary databases and cleaned them up.
- `next-env.d.ts` remains the pre-existing unstaged change with SHA-256 `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`; it is outside both commits.
- `.DS_Store` remains untracked and is outside both commits.
- The implementation checkpoint contains exactly five Gate 2 files; the handoff file is the only additional Gate 2 commit content.

## Independent review checkpoint

The implementation and recorded automated validation are ready for C2C inspection. Gate 2 remains partial until the authorized direct adapter smoke completes and the Control Room returns PASS. Do not begin Gate 3, merge, push, tag, or release before then.
