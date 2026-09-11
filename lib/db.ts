import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let singleton: Database.Database | undefined;
export function db() { const dbPath=process.env.JOB_AGENT_DB_PATH||path.join(process.cwd(), "data", "job-agent.db"); if (!singleton) { fs.mkdirSync(path.dirname(dbPath), {recursive:true}); singleton = new Database(dbPath); singleton.pragma("foreign_keys = ON"); migrate(singleton); } return singleton; }
function migrate(d: Database.Database) {
 d.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT UNIQUE, company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, work_model TEXT, posted_at TEXT, found_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, canonical_url TEXT NOT NULL, canonical_source TEXT NOT NULL, ats TEXT, external_id TEXT, jd_original TEXT NOT NULL, jd_hash TEXT NOT NULL, folder_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DISCOVERED', material_status TEXT NOT NULL DEFAULT 'NOT_GENERATED', review_status TEXT NOT NULL DEFAULT 'PENDING', application_status TEXT NOT NULL DEFAULT 'NOT_APPLIED', score INTEGER, score_explanation TEXT, analysis_json TEXT, priority INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE UNIQUE INDEX IF NOT EXISTS jobs_external_unique ON jobs(external_id) WHERE external_id IS NOT NULL;
 CREATE TABLE IF NOT EXISTS job_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, url TEXT NOT NULL UNIQUE, source_name TEXT NOT NULL, is_canonical INTEGER NOT NULL DEFAULT 0, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER REFERENCES jobs(id), action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS discovery_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at TEXT, sources_attempted TEXT, jobs_seen INTEGER NOT NULL DEFAULT 0, new_jobs INTEGER NOT NULL DEFAULT 0, duplicates INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, blocked_sources INTEGER NOT NULL DEFAULT 0, errors TEXT);
 CREATE TABLE IF NOT EXISTS duplicate_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, job_a_id INTEGER NOT NULL REFERENCES jobs(id), job_b_id INTEGER NOT NULL REFERENCES jobs(id), confidence REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', resolution_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
}
export function closeDb(){ singleton?.close(); singleton=undefined; }
