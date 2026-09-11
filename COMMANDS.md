# Commands

`npm install` installs local dependencies.

`npm run dev` starts the dashboard at `http://localhost:3000`.

`npm run db:migrate` creates/upgrades the SQLite database without deleting it.

`cp config/search.example.yaml config/search.yaml` and enable public Greenhouse/Lever boards, then run `npm run discover`.

`npm run export -- xlsx` (or `csv`) writes a portable export under `exports/`.

## Scheduling

Use a user-managed scheduler; the browser need not stay open. Example cron entry:

`0 8 * * 1-5 cd /path/to/job-agent && /usr/bin/env npm run discover >> logs/discovery.log 2>&1`

For macOS launchd or Windows Task Scheduler, invoke the same `npm run discover` command with the project as its working directory. Do not install schedulers automatically.
