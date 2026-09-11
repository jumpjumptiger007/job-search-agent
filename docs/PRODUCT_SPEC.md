# Product spec

V0.1 discovers public ATS listings, assigns immutable sequential job IDs after deterministic deduplication, captures original descriptions locally, and supports local review/export. Automation states (`DISCOVERED`, `ANALYZED`, `MATERIAL_GENERATED`) are deliberately separate from human review (`MATERIAL_APPROVED`) and application state (`READY_TO_APPLY`, `APPLIED`). Application submission is out of scope.
