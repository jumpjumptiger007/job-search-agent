import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import { closeDb,db } from "../lib/db";
import { ingest } from "../lib/jobs";

const file="/private/tmp/v065-integrity.sqlite",store="/private/tmp/v065-integrity-store";
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("V0.6.5 ingestion integrity",()=>{
 it("repairs a historically misowned URL using the consistent target identity",()=>{
  const owner=ingest({company:"Owner Co",title:"Role A",location:"Berlin",url:"https://owner.example/a",sourceName:"Owner Careers",externalId:"owner:a",description:"Owner listing"});
  ingest({company:"Owner Co",title:"Role A",location:"Berlin",url:"https://owner.example/a-mirror",sourceName:"Owner Mirror",externalId:"owner:a",description:"Owner listing"});
  const target=ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"});
  db().prepare("UPDATE job_sources SET job_id=?, is_canonical=0 WHERE url=?").run(owner.job.id,target.job.canonical_url);
  db().prepare("DELETE FROM job_sources WHERE job_id=? AND url=?").run(target.job.id,target.job.canonical_url);
  const repaired=ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"});
  expect(repaired).toMatchObject({created:false,job:{job_id:target.job.job_id}});
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:2});
  expect(db().prepare("SELECT job_id,is_canonical FROM job_sources WHERE url=?").get(target.job.canonical_url)).toEqual({job_id:target.job.id,is_canonical:1});
  expect(db().prepare("SELECT count(*) AS n FROM job_sources WHERE job_id=? AND url=?").get(owner.job.id,target.job.canonical_url)).toEqual({n:0});
  expect(db().prepare("SELECT url,is_canonical FROM job_sources WHERE job_id=? ORDER BY url").all(owner.job.id)).toEqual([{url:"https://owner.example/a",is_canonical:1},{url:"https://owner.example/a-mirror",is_canonical:0}]);
 });
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
 it("uses external ID fallback for a changed URL",()=>{
  const first=ingest({company:"Acme",title:"Engineer",location:"Berlin",url:"https://acme.example/jobs/1",sourceName:"Careers",externalId:"acme:1",description:"Original description"});
  const rediscovered=ingest({company:"Acme",title:"Engineer",location:"Berlin",url:"https://acme.example/jobs/2",sourceName:"Careers",externalId:"acme:1",description:"Original description"});
  expect(rediscovered).toMatchObject({created:false,job:{job_id:first.job.job_id}});
  expect(db().prepare("SELECT url,is_canonical FROM job_sources WHERE job_id=? ORDER BY url").all(first.job.id)).toEqual([{url:"https://acme.example/jobs/1",is_canonical:1},{url:"https://acme.example/jobs/2",is_canonical:0}]);
 });
 it("uses company, title, and location fallback for an existing listing",()=>{
  const first=ingest({company:"Acme",title:"Engineer",location:"Berlin",url:"https://acme.example/jobs/1",sourceName:"Careers",description:"Original description"});
  const rediscovered=ingest({company:"Acme",title:"Engineer",location:"Berlin",url:"https://mirror.example/jobs/1",sourceName:"Mirror",description:"Original description"});
  expect(rediscovered).toMatchObject({created:false,job:{job_id:first.job.job_id}});
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:1});
 });
 it("rolls back a new job when its initial source insert fails",()=>{
  db().exec("CREATE TRIGGER reject_initial_source BEFORE INSERT ON job_sources BEGIN SELECT RAISE(ABORT, 'source rejected'); END");
  expect(()=>ingest({company:"Acme",title:"Engineer",url:"https://acme.example/jobs/1",sourceName:"Careers",description:"Description"})).toThrow("source rejected");
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:0});
  expect(db().prepare("SELECT count(*) AS n FROM job_sources").get()).toEqual({n:0});
 });
 it("rolls back a failed source-ownership repair",()=>{
  const owner=ingest({company:"Owner Co",title:"Role A",location:"Berlin",url:"https://owner.example/a",sourceName:"Owner Careers",externalId:"owner:a",description:"Owner listing"});
  const target=ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"});
  db().prepare("UPDATE job_sources SET job_id=?, is_canonical=0 WHERE url=?").run(owner.job.id,target.job.canonical_url);
  db().prepare("DELETE FROM job_sources WHERE job_id=? AND url=?").run(target.job.id,target.job.canonical_url);
  db().exec("CREATE TRIGGER reject_source_repair BEFORE UPDATE OF job_id ON job_sources BEGIN SELECT RAISE(ABORT, 'repair rejected'); END");
  expect(()=>ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"})).toThrow("repair rejected");
  expect(db().prepare("SELECT job_id FROM job_sources WHERE url=?").get(target.job.canonical_url)).toEqual({job_id:owner.job.id});
 expect(db().prepare("SELECT count(*) AS n FROM job_sources WHERE job_id=? AND url=?").get(target.job.id,target.job.canonical_url)).toEqual({n:0});
 });
 it("refuses a repair that would leave the former owner without a source",()=>{
  const owner=ingest({company:"Owner Co",title:"Role A",location:"Berlin",url:"https://owner.example/a",sourceName:"Owner Careers",externalId:"owner:a",description:"Owner listing"});
  const target=ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"});
  db().prepare("UPDATE job_sources SET job_id=?, is_canonical=0 WHERE url=?").run(owner.job.id,target.job.canonical_url);
  db().prepare("DELETE FROM job_sources WHERE job_id=? AND url=?").run(target.job.id,target.job.canonical_url);
  db().prepare("DELETE FROM job_sources WHERE job_id=? AND url=?").run(owner.job.id,owner.job.canonical_url);
  const auditBefore=db().prepare("SELECT count(*) AS n FROM audit_events").get() as {n:number};
  expect(()=>ingest({company:"Target Co",title:"Role B",location:"Munich",url:"https://target.example/b",sourceName:"Target Careers",externalId:"target:b",description:"Target listing"})).toThrow("SOURCE_OWNERSHIP_REPAIR_UNSAFE");
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:2});
  expect(db().prepare("SELECT job_id FROM job_sources WHERE url=?").get(target.job.canonical_url)).toEqual({job_id:owner.job.id});
  expect(db().prepare("SELECT canonical_url FROM jobs WHERE id=?").get(owner.job.id)).toEqual({canonical_url:owner.job.canonical_url});
  expect(db().prepare("SELECT count(*) AS n FROM audit_events").get()).toEqual(auditBefore);
 });
});
