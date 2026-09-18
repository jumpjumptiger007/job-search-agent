import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import { closeDb,db } from "../lib/db";
import { ingest } from "../lib/jobs";

const file="/private/tmp/v065-integrity.sqlite",store="/private/tmp/v065-integrity-store";
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("V0.6.5 ingestion integrity",()=>{
 it("keeps identical descriptions from different listings separate with their own sources",()=>{
  const description="The same normalized description for independent roles.";
  const first=ingest({company:"Acme",title:"Engineer",location:"Berlin",url:"https://acme.example/jobs/1",sourceName:"Acme Careers",externalId:"acme:1",description});
  const second=ingest({company:"Beta",title:"Designer",location:"Munich",url:"https://beta.example/jobs/2",sourceName:"Beta Careers",externalId:"beta:2",description});
  expect(second.created).toBe(true);
  expect(db().prepare("SELECT job_id,canonical_url FROM jobs ORDER BY job_id").all()).toEqual([{job_id:first.job.job_id,canonical_url:"https://acme.example/jobs/1"},{job_id:second.job.job_id,canonical_url:"https://beta.example/jobs/2"}]);
  expect(db().prepare("SELECT jobs.job_id,job_sources.url,job_sources.is_canonical FROM job_sources JOIN jobs ON jobs.id=job_sources.job_id ORDER BY jobs.job_id").all()).toEqual([{job_id:first.job.job_id,url:"https://acme.example/jobs/1",is_canonical:1},{job_id:second.job.job_id,url:"https://beta.example/jobs/2",is_canonical:1}]);
 });
 it("preserves URL identity when rediscovered metadata changes",()=>{
  const first=ingest({company:"Acme",title:"Engineer",url:"https://acme.example/jobs/1",sourceName:"Careers",externalId:"acme:1",description:"Original description"});
  const rediscovered=ingest({company:"Changed Co",title:"Changed title",location:"Hamburg",url:"https://acme.example/jobs/1",sourceName:"Mirror",externalId:"changed:1",description:"Changed description"});
  expect(rediscovered).toMatchObject({created:false,job:{job_id:first.job.job_id}});
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:1});
 });
 it("rolls back a new job when its initial source insert fails",()=>{
  db().exec("CREATE TRIGGER reject_initial_source BEFORE INSERT ON job_sources BEGIN SELECT RAISE(ABORT, 'source rejected'); END");
  expect(()=>ingest({company:"Acme",title:"Engineer",url:"https://acme.example/jobs/1",sourceName:"Careers",description:"Description"})).toThrow("source rejected");
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:0});
  expect(db().prepare("SELECT count(*) AS n FROM job_sources").get()).toEqual({n:0});
 });
});
