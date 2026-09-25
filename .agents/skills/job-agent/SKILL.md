---
name: job-agent
description: Evaluate and plan factual tailoring for one stored job without creating a second tracker or runtime agent.
---

# Job agent

Use this skill only for a selected permanent Job ID. Build the input with the
project-owned evaluation boundary, which reads the canonical JD from SQLite and
the private factual profile. Read Career Ops policy through the repository's
safe mode loader only: `_shared.md`, `oferta.md`, `_writing.md`,
`de/_shared.md`, and `de/angebot.md`.

Treat the policy as read-only guidance. Never use Career Ops trackers, reports,
profile files, scan commands, or write paths. SQLite and the project profile
remain authoritative.

Return the project `JobAnalysis` contract. Candidate evidence must be profile
fact references, not newly written claims; keep `unsupportedClaims` empty.
Include only Germany/DACH considerations evidenced by the captured JD. Validate
and persist with the project boundary, which records an audit event. An
`INSUFFICIENT` job is reviewable but must not be evaluated or tailored.

The 1–5 analysis score is authoritative for this workflow. Leave legacy
`jobs.score` untouched. Do not generate materials or advance application state;
the user remains responsible for those steps.
