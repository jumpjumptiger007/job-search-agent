# Job Search Agent

A local-first, single-user, Germany-focused, macOS-oriented job-search workflow. The normal interface is the macOS Electron desktop application, which opens the existing Next.js Dashboard. SQLite is the canonical operational state; candidate profile data and generated materials remain local and private. Codex Desktop is the external analysis and tailoring orchestrator—there is no LLM runtime inside the Dashboard or Electron app. Discovery is manually triggered, and applications are always submitted manually.

Electron is a desktop shell around the existing Next.js application, not a separate application or a self-contained distribution.

## Desktop app

`Job Search Agent.app` starts the existing production Next.js backend from the selected local workspace, opens the Dashboard in an Electron window, and stops the backend when the app explicitly quits. On first launch, choose the local `job-search-agent` workspace in the folder picker. A second Finder or Dock launch activates the existing app window instead of starting another backend; internal Dashboard navigation stays in the app and employer links open in the default browser.

The v0.9 desktop package has these limitations:

- macOS Apple Silicon (`arm64`) only
- Unsigned and not notarized
- Not a clean-machine standalone installer; it uses the existing local repository/workspace
- Requires the existing local Node environment
- Requires the existing Python/RenderCV environment for resume generation
- Bun is optional and needed only when LinkedIn discovery is enabled

The generated app is at `desktop/out/Job Search Agent-darwin-arm64/Job Search Agent.app`. Packaging does not bundle the workspace, its data, or these runtimes.

## Discovery sources

- Bundesagentur für Arbeit
- LinkedIn public jobs (optional, low-volume, requires Bun)
- Greenhouse and Lever
- Personio career sources you configure explicitly
- Bounded web search and official careers pages

There is no direct StepStone, Indeed, or XING integration.

## Requirements

- macOS on Apple Silicon for the desktop app
- Node.js and npm
- Python 3.12 or newer (required by the pinned RenderCV release)
- Git
- Codex Desktop for job analysis and tailoring
- Bun only if you enable LinkedIn discovery

## Install and setup

Clone the repository and its submodules, then install the project dependencies and prepare RenderCV:

```bash
git clone --recurse-submodules https://github.com/jumpjumptiger007/job-search-agent.git
cd job-search-agent
npm install

python3 -m venv .rendercv-venv
.rendercv-venv/bin/python -m pip install -r rendercv-requirements.txt

cp config/search.example.yaml config/search.yaml
cp config/preferences.example.yaml config/preferences.yaml

npm run db:migrate
npm run career-ops:doctor
npm run rendercv:doctor
```

Create the private candidate profile in `profile/profile.yaml` using your own factual information. The file is git-ignored. Configure your discovery sources in `config/search.yaml` and preferences in `config/preferences.yaml`; both are local private copies.

### Normal desktop use

Build the existing Next.js app, package the Electron shell, then launch the generated app:

```bash
npm run build
npm run desktop:package
open "desktop/out/Job Search Agent-darwin-arm64/Job Search Agent.app"
```

On first launch, select the local `job-search-agent` workspace. The app remembers that workspace for later launches. The package relies on its existing Node, Python/RenderCV, profile, configuration, and SQLite setup; it is not a self-contained installer.

### Development use

For browser-based Dashboard development, run:

```bash
npm run dev
```

Then open <http://localhost:3000>. `npm run dev` is the development workflow, not the normal daily-use launch method. `npm run desktop:dev` starts the Electron shell development workflow.

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

1. Launch `Job Search Agent.app`.
2. Run Discovery manually from the Dashboard.
3. Review jobs and mark each **Interested** or **Skip**.
4. For an Interested job, use **Copy Codex prompt** in the Dashboard.
5. In Codex Desktop, run the copied job-specific analysis prompt: `Analyze JOB-xxxx using the job-agent workflow.`
6. Return to the app and review the validated analysis.
7. Generate and inspect materials.
8. Open the employer application page and apply manually.
9. Track application state in the Dashboard.

Codex Desktop is a separate application; it is not embedded in Electron.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run desktop:dev` | Start the Electron shell development workflow |
| `npm run desktop:package` | Package the macOS arm64 Electron shell |
| `npm run dev` | Start the Dashboard for browser-based development |
| `npm run discover` | Run job discovery manually from the command line |
| `npm run db:migrate` | Create or migrate the local database |
| `npm run verify` | Run tests, typecheck, lint, and build |
| `npm run verify:db` | Check local database integrity |
| `npm run career-ops:doctor` | Check the Career Ops submodule setup |
| `npm run rendercv:doctor` | Check RenderCV setup |
| `npm run export -- xlsx` | Export jobs as XLSX |
| `npm run export -- csv` | Export jobs as CSV |

`desktop:*` commands operate on the Electron desktop shell. `npm run dev` runs the browser-based development workflow.

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
