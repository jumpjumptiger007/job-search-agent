# Local Job Search Automation v0.1.0

Local-only, single-user job discovery, scoring, application-material preparation, and status tracking. It never submits an application.

This is a deterministic local automation tool, not an autonomous AI agent. Runtime behavior is implemented with local code, configuration, SQLite, filesystem storage, and public ATS endpoints. It does not require an LLM provider.

Codex or Claude Code can be used externally to maintain the repository, run commands, inspect results, and extend workflows, but they are not runtime dependencies of the tool.

## First run

1. Run `npm install`, then `npm run dev`.
2. Copy example configuration files into private counterparts and add your own factual profile/CV under `profile/`.
3. Configure public ATS boards in `config/search.yaml`, then select **Run Discovery** or run `npm run discover`.

No private candidate information, runtime database, job captures, exports, or generated materials is tracked in Git.

See [COMMANDS.md](COMMANDS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
