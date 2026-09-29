# Source Expansion — Gate 6 Hardening & Provenance Handoff

## Status

**Gate 6 execution is complete and ready for independent Control Room review.** Gate 7 remains on hold until that review returns PASS.

## Baseline and checkpoint

- Package baseline: `0.9.1`; no release version was assigned to this sprint.
- Main baseline: `c7e3dd7165db22603e0b7cd9c5802fce88a22402`.
- Gate 3 reviewed checkpoint: `cefe9a31e353223a97efddfcb53d1cb3c4f4c5fe`.
- Implementation branch: `feature/source-expansion`.
- Gate 6 test repair commit: `1f2b699` (`test(discovery): surface incompatible Workable response`).
- Gate 6 changed no production code. Its implementation repair adds one Workable response-shape regression test; this handoff is the Gate 6 checkpoint document.
- No push, merge, tag, or release was performed.

## Reviewed branch scope

The branch adds the native Arbeitnow and Workable adapters, wires them through the existing discovery loop, adds disabled-by-default example configuration and focused tests, and records the Gate 2/3 evidence. The only product-code change is the two adapters and their discovery wiring. No unrelated product code, database migration, or schema change entered the branch.

Gate 1 Arbeitnow, Gate 2 Workable, and Gate 3 composite source audit are PASS. Gates 4 (JobSpy/Indeed) and 5 (additional provider-health infrastructure) were explicitly skipped by the Control Room.

## Gate 6 audit results

- **Failure isolation:** existing tests show an Arbeitnow failure does not stop a configured Greenhouse provider, and a Workable failure does not stop Arbeitnow. The added regression test verifies that a successful HTTP response with an incompatible Workable JSON shape becomes a visible `Workable: Workable returned invalid JSON jobs` source failure.
- **Bounds and configuration:** Arbeitnow uses only the public feed, a configured raw cap of 50, and a three-page maximum. Workable uses the configured cap of 50 and a three-request maximum; it sends the existing role-family query and Germany location, with no posting-age parameter. Both remain disabled in `config/search.example.yaml`. The local runtime config keeps both enabled at 50 and Generic Web Search disabled. LinkedIn remains as configured and was not queried or changed.
- **Identity and dedupe:** adapters perform only in-memory duplicate suppression within their bounded result set. Existing ingestion continues to own permanent Job IDs and cross-source deduplication. No provider-specific persistent state or database table was added.
- **State safety:** Gate 6 did not run persistent Discovery or write the real job database, candidate profile, application state, or materials/CV state. The focused provider tests use unique temporary SQLite and storage roots; full verification ran in an isolated clone. The read-only `config`/`data` file fingerprint remained unchanged across verification. No migration is needed.
- **Dependencies:** the branch adds no Python, JobSpy, PBP runtime, browser automation, or npm dependency. Its `package.json` change only adds the provider test files to `verify:core`; `package-lock.json` is unchanged.
- **Provenance and licensing:** I compared the new adapters with the pinned Career Ops providers at submodule commit `de7f7fe`. Workable uses the public global search endpoint `/api/v1/jobs`; the vendored implementation uses an account-specific widget endpoint and markdown fallback. Arbeitnow necessarily maps fields from the same public feed, but the adapter has its own normalization, identity, bounds, and error handling and does not import or translate the vendored implementation. No substantial external code was copied. No PBP implementation or other external provider code was added, so no additional attribution is required. The vendor checkout was not modified.
- **Workable maintenance risk:** `https://jobs.workable.com/api/v1/jobs` remains undocumented in Workable's published API material. Gate 2/3 handoffs already record this limitation. The adapter throws on incompatible response shape, and discovery surfaces that error through its existing source-level failure handling. Gate 6 made no network-behavior change and issued no live-source request.

## Validation

- `npx vitest run tests/arbeitnow-discovery.test.ts tests/workable-discovery.test.ts` — **17 passed across 2 files**.
- `npm run verify` in an isolated copy of the exact Gate 6 implementation commit — **PASS**: 227 tests across 25 files, typecheck, lint, and production build.
- Lint reported 0 errors and one existing warning at `app/discovery-actions.tsx:46`.
- The successful production build reported existing dynamic-filesystem tracing warnings from `lib/project-root.ts`; it completed successfully.
- An initial isolated-build attempt used a dependency symlink outside the temporary project root, which Turbopack rejected. The validation harness was corrected by copying dependencies and the pinned Career Ops submodule inside the temporary root; the final full verification then passed.
- Validation-created temporary clones were removed. No temporary test files remained.

## Git and private-data safety

- At the Gate 6 checkpoint, the only tracked working-tree change is the pre-existing unstaged `next-env.d.ts` edit, preserved byte-for-byte at SHA-256 `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`.
- `.DS_Store` remains untracked and is not included.
- No staged leftovers or conflicts remain after the handoff commit.
- Independent Control Room review is pending; do not begin Gate 7 until it returns PASS.
