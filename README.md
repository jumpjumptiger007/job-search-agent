# Local Job Search Automation v0.5.0 (unreleased)

Local-only, single-user job discovery, scoring, application-material preparation, and status tracking. It never submits an application.

This is a deterministic local automation tool, not an autonomous AI agent. Runtime behavior is implemented with local code, configuration, SQLite, filesystem storage, and public ATS endpoints. It does not require an LLM provider.

Codex or Claude Code can be used externally to maintain the repository, run commands, inspect results, and extend workflows, but they are not runtime dependencies of the tool.

## First run

1. Run `npm install`, then `npm run dev`.
2. Copy example configuration files into private counterparts and add your own factual profile/CV under `profile/`.
3. Set role, location, work-model, `workingLanguage`, other-language, and run-limit preferences in private `config/preferences.yaml`. Review new jobs as **Interested** or **Skip** before generating factual materials.

No private candidate information, runtime database, job captures, exports, or generated materials is tracked in Git.

See [COMMANDS.md](COMMANDS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Discovery can also use explicitly configured public Personio career sources. Germany-based filtering rejects only clear incompatible location or work-authorisation evidence; ambiguous listings remain for review.
