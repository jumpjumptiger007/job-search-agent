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

### Unsigned DMG distribution

On an Apple Silicon Mac, install the desktop packaging dependencies and create the DMG:

```bash
npm ci --prefix desktop
npm run desktop:dmg
```

This packages the shell and produces `desktop/out/make/Job Search Agent-0.9.0-arm64.dmg`. The **Job Search Agent** volume contains `Job Search Agent.app` and an Applications-folder drag target. Mount the DMG, drag the app to Applications, and launch it through Finder or the Dock.

The DMG and app are **Apple Silicon (`arm64`) only, unsigned, and not notarized**. macOS Gatekeeper may block first launch; after attempting to open the app, you may need to allow it under **System Settings → Privacy & Security → Open Anyway**.

This is not a clean-machine standalone installer. Prepare the existing `job-search-agent` workspace with its production build (`npm run build`), installed Node and project dependencies, private profile/configuration, SQLite database, and existing Python/RenderCV environment before selecting it in the app. The package does not bundle Node, Python, RenderCV, workspace data, profile/configuration, or Codex Desktop; Codex Desktop remains a separate application.

## Discovery sources

Discovery only searches sources enabled in your private `config/search.yaml`. The public `config/search.example.yaml` intentionally ships with every source disabled. After copying it to `config/search.yaml`, enable at least one source before **Run Discovery** can retrieve jobs.

- **Bundesagentur für Arbeit** — general Germany-focused discovery.
- **Bounded web search** — general discovery signal from a small number of web queries; results may include official careers pages.
- **LinkedIn public jobs** — optional, low-volume discovery; requires Bun when enabled.
- **Greenhouse** — optional target-company discovery; requires an explicit board.
- **Lever** — optional target-company discovery; requires an explicit company.
- **Personio** — optional target-company discovery; requires an explicit public careers source.

Use Greenhouse, Lever, or Personio when you already want to follow a specific employer whose careers site uses that platform. These sources search only the configured board, company, or public careers source; they are not general searches across every employer using those ATS platforms. General discovery remains Bundesagentur and bounded web search, with LinkedIn available as an optional source. Configure target-company sources only for employers you specifically want to follow. There is no direct StepStone, Indeed, or XING integration.

## Requirements

- macOS on Apple Silicon for the desktop app
- Node.js and npm
- Python 3.12 or newer (required by the pinned RenderCV release)
- Git
- Codex Desktop for job analysis and tailoring
- Bun only if you enable LinkedIn discovery

## First run

1. Clone the repository and submodules, install dependencies, and prepare RenderCV:

```bash
git clone --recurse-submodules https://github.com/jumpjumptiger007/job-search-agent.git
cd job-search-agent
npm install

python3 -m venv .rendercv-venv
.rendercv-venv/bin/python -m pip install -r rendercv-requirements.txt
```

2. Create your private `profile/profile.yaml` using the guidance below.
3. Copy `config/preferences.example.yaml` to `config/preferences.yaml` and set your job preferences.
4. Copy `config/search.example.yaml` to `config/search.yaml` and enable at least one discovery source. A minimal Germany-oriented start is:

   ```yaml
   bundesagentur:
     enabled: true

   webSearch:
     enabled: true

   linkedin:
     enabled: false
   ```

   LinkedIn can be enabled later after installing Bun.

5. Prepare and check the local database and integrations:

   ```bash
   npm run db:migrate
   npm run career-ops:doctor
   npm run rendercv:doctor
   ```

6. Build and package the desktop app:

   ```bash
   npm run build
   npm run desktop:package
   ```

7. Launch `Job Search Agent.app` and select the local repository workspace when prompted.
8. Run **Run Discovery** manually in the Dashboard.
9. Use Codex Desktop for job analysis and tailoring through the Dashboard's **Copy Codex prompt** action.

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

## Personal setup

The app uses three local, private configuration files. All three are ignored by Git:

- `profile/profile.yaml` — factual candidate profile: who you are.
- `config/preferences.yaml` — job-search preferences: what jobs you want.
- `config/search.yaml` — discovery providers: where jobs should be searched.

### Candidate profile

`profile/profile.yaml` is the factual source of truth used for job analysis and generated materials. Existing PDF or DOCX CV files are **not** automatically parsed or imported. Simply placing a CV in `profile/` does not configure your candidate profile; enter your facts in `profile/profile.yaml`.

Generated materials may select and rephrase facts from the profile, but must not invent candidate facts. Replace this fictional example with accurate information about yourself:

```yaml
name: Example Person
location: Berlin, Germany
summary: Example analyst with experience turning operational data into clear reports.
skills:
  - Example skill
  - Data analysis
experience:
  - employer: Example Company
    title: Example Analyst
    dates: 2022-2025
    bullets:
      - Prepared example reports for a fictional team
education:
  - Example University — BSc Example Studies, 2018-2022
languages:
  - German
  - English
```

### Job preferences

Copy `config/preferences.example.yaml` to `config/preferences.yaml`. These are the current runtime-supported discovery settings:

```yaml
discovery:
  roleFamilies:
    - Data Analyst
    - Business Analyst
  seniority:
    - mid
    - senior
  location: Germany
  radiusKm: 0
  remotePreference: any
  workingLanguage: German & English
  otherLanguages:
    - language: Spanish
      requirement: Preferred
  postingAgeDays: 30
  limits:
    perRun: 25
```

`roleFamilies` guides role searches and filters unrelated titles. `seniority` can exclude explicitly junior or student roles when `mid` or `senior` is selected. `workingLanguage` accepts `German`, `English`, or `German & English` and filters listings with explicit language requirements; `otherLanguages` can mark another language `Required` or `Preferred`. `postingAgeDays` filters dated listings to the selected recency window. `limits.perRun` caps the total jobs accepted in one discovery run. `location` and `radiusKm` guide location-based discovery; `remotePreference` can be `any`, `remote`, or `hybrid`.

### Discovery providers

Copy `config/search.example.yaml` to `config/search.yaml`. Its sources are all disabled by design, so enable at least one source before running discovery. The minimal starter shown in the first-run checklist enables Bundesagentur and bounded web search for Germany. To opt into low-volume LinkedIn public jobs, [install Bun](https://bun.sh/docs/installation), then set `linkedin.enabled: true` in your private file. Greenhouse, Lever, and Personio are optional target-company providers: use them for a specific employer you already want to follow, configuring an explicit Greenhouse board, Lever company, or public Personio careers source. They do not discover tenants or search every employer on those platforms; there is no need to configure many employers by default.

### ATS metadata and resume tailoring

ATS detection and discovery are separate from resume tailoring. A recorded ATS type supports job discovery, source handling, and metadata; it does not change resume formatting for Greenhouse, Lever, Personio, or another ATS brand. For each job, Codex analysis selects factual skills, experience, and bullets from `profile/profile.yaml`, and identifies relevant keywords in that job description. RenderCV builds the resume from the selected profile facts using the project's fixed ATS-friendly design; it does not apply vendor-specific formatting or claim that a resume will pass every ATS.

In short: general discovery uses Bundesagentur, bounded Web Search, and optionally LinkedIn; target-company discovery can use Greenhouse, Lever, or Personio; resume tailoring uses job-description-specific factual selection plus RenderCV, independently of ATS vendor.

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
| `npm run desktop:dmg` | Package the shell and create an unsigned macOS arm64 DMG |
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
