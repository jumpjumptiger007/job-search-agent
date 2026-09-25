import fs from "node:fs";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { closeDb,db } from "../lib/db";
import { ingest,selectCanonical,setApplicationStatus,setReviewStatus,workflowQueues } from "../lib/jobs";
import { hashJobDescription,normalizeIdentity } from "../lib/core/job-identity";
import { classifyWorkflowQueues,isReadyToApply } from "../lib/core/job-workflow";
import type { NormalizedJob } from "../lib/types";

const file="/private/tmp/v071-core-boundary.sqlite",store="/private/tmp/v071-core-boundary-store";
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
const job:NormalizedJob={company:"Acme",title:"Engineer",location:"Berlin",url:"https://example.com/job",sourceName:"Platform",description:"TypeScript role"};

describe("V0.7.1 core boundary",()=>{
 it("accepts NormalizedJob through the compatibility ingestion API and preserves canonical selection",()=>{const first=ingest(job),second=ingest({...job,url:"https://careers.acme.example/job",sourceName:"Careers"});expect(second.created).toBe(false);expect(second.job.job_id).toBe(first.job.job_id);expect(selectCanonical({url:job.url,sourceName:job.sourceName},{url:second.job.canonical_url,sourceName:second.job.canonical_source}).sourceName).toBe("Careers");});
 it("keeps workflow decisions pure and compatibility queues unchanged",()=>{const saved=ingest(job).job;setReviewStatus(saved.job_id,"INTERESTED");db().prepare("UPDATE jobs SET material_status='READY' WHERE id=?").run(saved.id);const ready=setApplicationStatus(saved.job_id,"READY_TO_APPLY");expect(isReadyToApply(ready)).toBe(true);expect(classifyWorkflowQueues([ready]).readyToApply).toEqual([ready]);expect(workflowQueues().readyToApply.map(x=>x.job_id)).toEqual([ready.job_id]);expect(normalizeIdentity("HTTPS://www.Acme.com/A")).toBe("acme com a");expect(hashJobDescription("TypeScript role")).toHaveLength(64);});
 it("keeps pure core free of persistence and filesystem imports",()=>{for(const file of ["lib/core/job-identity.ts","lib/core/job-workflow.ts"]){const source=fs.readFileSync(file,"utf8");expect(source).not.toMatch(/from ["']\.\.\/db["']|from ["']node:fs["']|from ["']node:path["']/);}});
});
