# Job Search Agent v0.7.1

A local-first, single-user, Germany-focused job-search workflow. It discovers jobs, lets you review and mark them Interested or Skip, supports Codex-assisted validated 1–5 analysis and factual CV/cover-letter tailoring, generates resumes with RenderCV, and tracks applications in local SQLite. Applications are always submitted manually; this tool never submits one automatically.

SQLite is the canonical operational state. Candidate facts and generated materials stay local. Codex Desktop is the external analysis and tailoring orchestrator; the Dashboard itself does not call an LLM.

## Discovery sources

- Bundesagentur für Arbeit
- LinkedIn public jobs (optional, low-volume, requires Bun)
- Greenhouse and Lever
- Personio career sources you configure explicitly
- Bounded Web Search and official career pages

There is no direct StepStone, Indeed, or XING integration.

## Requirements

- Node.js and npm
- Python 3.12 or newer (required by the pinned RenderCV release)
- Git
- Codex Desktop for job analysis and tailoring
- Bun only if you enable LinkedIn discovery

## Install

```bash
git clone --recurse-submodules <repository>
cd job-search-agent
npm install

python3 -m venv .rendercv-venv
.rendercv-venv/bin/python -m pip install -r rendercv-requirements.txt

cp config/search.example.yaml config/search.yaml
cp config/preferences.example.yaml config/preferences.yaml

npm run db:migrate
npm run career-ops:doctor
npm run rendercv:doctor
npm run dev
```

The Dashboard is at <http://localhost:3000>.

### Optional: LinkedIn discovery

Install Bun using the [official Bun installer](https://bun.sh/docs/installation), then enable this in your private `config/search.yaml`:

```yaml
linkedin:
  enabled: true
  limit: 5
```

## Private candidate profile

Create `profile/profile.yaml`. Git ignores this file. Use only your own factual information; for example:

```yaml
name: Example Person
location: Berlin, Germany
skills:
  - Python
  - Data analysis
experience:
  - employer: Example Studio
    title: Junior Analyst
    dates: 2023-2025
    bullets:
      - Prepared monthly reports
education:
  - institution: Example University
    degree: BSc Example Studies
    dates: 2019-2023
```

## Daily workflow

1. Start the app with `npm run dev`.
2. In the Dashboard, select **Run Discovery**.
3. Review discovered jobs and mark promising ones **Interested**; mark others **Skip**.
4. In Codex Desktop, run `Analyze JOB-xxxx using the job-agent workflow.`
5. Return to the Dashboard and review the validated 1–5 analysis.
6. Generate materials and inspect the resume and cover letter.
7. Apply manually, then track application status locally in the Dashboard.

You can reuse one dedicated Codex analysis thread for multiple jobs. Keep each Job ID explicit in your request.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Dashboard |
| `npm run discover` | Run job discovery |
| `npm run db:migrate` | Create or migrate the local database |
| `npm run verify` | Run tests, typecheck, lint, and build |
| `npm run verify:db` | Check local database integrity |
| `npm run career-ops:doctor` | Check the Career Ops submodule setup |
| `npm run rendercv:doctor` | Check RenderCV setup |
| `npm run export -- xlsx` | Export jobs as XLSX |
| `npm run export -- csv` | Export jobs as CSV |

## Privacy

Keep these files and directories private; they are git-ignored:

- `profile/*` except `profile/README.md`
- `config/search.yaml` and `config/preferences.yaml`
- SQLite database files
- `jobs/JOB-*`
- generated materials and exports
- `.env`

Public example configuration contains no private candidate data.

## Security

`xlsx@0.18.5` is currently retained only for spreadsheet export. The project does not parse uploaded or arbitrary XLSX files. Known SheetJS advisories concern parsing crafted workbooks, so that attack path is not exposed by the current application; `npm audit` may still report the dependency. If XLSX import or parsing is introduced, upgrade or replace `xlsx` with a non-vulnerable implementation first.

See [COMMANDS.md](COMMANDS.md) for more commands and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system details.
