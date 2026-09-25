import { afterEach,beforeEach,describe,expect,it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import { closeDb,db } from "../lib/db";
import { verifyDbIntegrity } from "../lib/db-integrity";
import { ingest } from "../lib/jobs";

const file="/private/tmp/v07-db-integrity.sqlite",store="/private/tmp/v07-db-integrity-store";
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
const add=()=>ingest({company:"Acme",title:"Engineer",url:"https://careers.example/jobs/1",sourceName:"Careers",description:"TypeScript role"}).job;

describe("V0.7 read-only DB integrity checker",()=>{
 it("accepts a valid migrated database without changing it",()=>{const job=add();closeDb();expect(verifyDbIntegrity(file)).toEqual({valid:true,violations:{canonicalSource:[],canonicalSourceIdentity:[],canonicalSourceCount:[],orphanSource:[],invalidJobId:[],duplicateJobId:[],invalidReviewState:[],invalidApplicationState:[]}});const check=new Database(file,{readonly:true});expect(check.prepare("SELECT job_id FROM jobs").all()).toEqual([{job_id:job.job_id}]);check.close();});
 it("reports canonical source identity drift",()=>{const job=add();db().prepare("UPDATE job_sources SET source_name=? WHERE job_id=? AND is_canonical=1").run("Wrong Source",job.id);closeDb();expect(verifyDbIntegrity(file).violations.canonicalSourceIdentity).toEqual([job.job_id]);});
 it("reports broken identity, source, and workflow invariants",()=>{const job=add();const writable=db();writable.prepare("UPDATE jobs SET canonical_url=?, job_id=?, review_status=?, application_status=? WHERE id=?").run("https://careers.example/missing","BAD-1","UNKNOWN","SUBMITTED",job.id);writable.prepare("UPDATE job_sources SET is_canonical=0 WHERE job_id=?").run(job.id);closeDb();const corrupt=new Database(file);corrupt.pragma("foreign_keys = OFF");corrupt.prepare("INSERT INTO job_sources(job_id,url,source_name,is_canonical) VALUES(?,?,?,0)").run(999,"https://orphan.example/job","Orphan");corrupt.close();const report=verifyDbIntegrity(file);expect(report.valid).toBe(false);expect(report.violations).toMatchObject({canonicalSource:["BAD-1"],canonicalSourceCount:["BAD-1"],orphanSource:[expect.any(String)],invalidJobId:["BAD-1"],invalidReviewState:["BAD-1"],invalidApplicationState:["BAD-1"]});});
});
