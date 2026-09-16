import type Database from "better-sqlite3";

type Migration = { version: number; apply: (db: Database.Database) => void };

const baseSchema = `
  CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT UNIQUE, company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, work_model TEXT, posted_at TEXT, found_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, canonical_url TEXT NOT NULL, canonical_source TEXT NOT NULL, ats TEXT, external_id TEXT, jd_original TEXT NOT NULL, jd_hash TEXT NOT NULL, folder_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DISCOVERED', material_status TEXT NOT NULL DEFAULT 'NOT_GENERATED', review_status TEXT NOT NULL DEFAULT 'PENDING', application_status TEXT NOT NULL DEFAULT 'NOT_APPLIED', score INTEGER, score_explanation TEXT, analysis_json TEXT, priority INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE UNIQUE INDEX IF NOT EXISTS jobs_external_unique ON jobs(external_id) WHERE external_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS job_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, url TEXT NOT NULL UNIQUE, source_name TEXT NOT NULL, is_canonical INTEGER NOT NULL DEFAULT 0, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER REFERENCES jobs(id), action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS discovery_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at TEXT, sources_attempted TEXT, jobs_seen INTEGER NOT NULL DEFAULT 0, new_jobs INTEGER NOT NULL DEFAULT 0, duplicates INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, blocked_sources INTEGER NOT NULL DEFAULT 0, errors TEXT);
  CREATE TABLE IF NOT EXISTS duplicate_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, job_a_id INTEGER NOT NULL REFERENCES jobs(id), job_b_id INTEGER NOT NULL REFERENCES jobs(id), confidence REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', resolution_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`;

const migrations: Migration[] = [
  { version: 1, apply: (db) => db.exec(baseSchema) },
  {
    version: 2,
    apply: (db) => {
      db.exec("CREATE TABLE IF NOT EXISTS job_id_sequence (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), last_value INTEGER NOT NULL)");
      db.prepare("INSERT OR IGNORE INTO job_id_sequence(singleton, last_value) VALUES(1, 0)").run();
      db.prepare(`UPDATE job_id_sequence SET last_value = MAX(last_value, COALESCE((SELECT MAX(CAST(SUBSTR(job_id, 5) AS INTEGER)) FROM jobs WHERE job_id GLOB 'JOB-[0-9]*'), 0)) WHERE singleton = 1`).run();
    },
  },
  {
    version: 3,
    apply: (db) => {
      db.prepare("INSERT OR IGNORE INTO job_sources(job_id, url, source_name, is_canonical) SELECT id, canonical_url, canonical_source, 1 FROM jobs").run();
      db.prepare("UPDATE job_sources SET is_canonical = CASE WHEN url = (SELECT canonical_url FROM jobs WHERE jobs.id = job_sources.job_id) THEN 1 ELSE 0 END").run();
    },
  },
];

export function migrate(db: Database.Database) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const applied = new Set((db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((row) => row.version));
  db.transaction(() => {
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      migration.apply(db);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(?, CURRENT_TIMESTAMP)").run(migration.version);
    }
  })();
}
