# Local Job Search Automation v0.7.0

Local-only, single-user job discovery, validated evaluation, application-material preparation, and status tracking. It never submits an application.

This is a deterministic local automation tool, not an autonomous AI agent. Runtime behavior is implemented with local code, configuration, SQLite, filesystem storage, and public ATS endpoints. It does not require an LLM provider.

Codex Desktop orchestrates explicit evaluation and tailoring; Career Ops supplies read-only upstream capabilities. SQLite is the sole canonical operational state. Discovery stops at Review, and material generation requires the factual profile plus a validated analysis/tailoring plan. Neither is a runtime LLM dependency.

## First run

1. Run `npm install`, then `npm run dev`.
2. Copy the current public discovery-preferences example into a private counterpart and add your own factual profile under `profile/`.
3. Set role, location, work-model, language, and run-limit preferences in private `config/preferences.yaml`. Review new jobs as **Interested** or **Skip**; selected jobs require validated evaluation/tailoring before factual materials are generated.

No private candidate information, runtime database, job captures, exports, or generated materials is tracked in Git.

See [COMMANDS.md](COMMANDS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Discovery can also use explicitly configured public Personio career-site URLs (for example, `https://company.jobs.personio.de`). Germany-based filtering rejects clear foreign-local structured locations while retaining explicit EU/Europe/worldwide, mixed, and ambiguous listings for review.
