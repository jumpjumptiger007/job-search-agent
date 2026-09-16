import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "./migrations";

let singleton: Database.Database | undefined;
export function db() { const dbPath=process.env.JOB_AGENT_DB_PATH||path.join(process.cwd(), "data", "job-agent.db"); if (!singleton) { fs.mkdirSync(path.dirname(dbPath), {recursive:true}); singleton = new Database(dbPath); singleton.pragma("foreign_keys = ON"); migrate(singleton); } return singleton; }
export function closeDb(){ singleton?.close(); singleton=undefined; }
