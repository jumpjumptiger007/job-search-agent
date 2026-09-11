# Job Search Agent v0.1.0

Local-first, human-controlled job discovery and application-material preparation. It never submits an application.

## First run

1. Run `npm install`, then `npm run dev`.
2. Copy example configuration files into private counterparts and add your own factual profile/CV under `profile/`.
3. Configure public ATS boards in `config/search.yaml`, then select **Run Discovery** or run `npm run discover`.

No private candidate information, runtime database, job captures, exports, or generated materials is tracked in Git.

See [COMMANDS.md](COMMANDS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
