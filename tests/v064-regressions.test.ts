import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { closeDb,db } from "../lib/db";
import { ingest,setReviewStatus,workflowQueues } from "../lib/jobs";
import JobPage from "../app/jobs/[id]/page";
import { POST } from "../app/api/jobs/[id]/application/route";

const file="/private/tmp/v064-regressions.sqlite",store="/private/tmp/v064-regressions-store";
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("V0.6.4 source URL identity",()=>{
 it("resolves a known URL before changed secondary identity can create a duplicate",()=>{
  const original=ingest({company:"Acme",title:"Senior Product Manager",location:"Berlin",url:"https://careers.example/jobs/1",sourceName:"Careers",ats:"BA",externalId:"ba:1",description:"Rich factual description for the existing role.",contentStatus:"SUBSTANTIVE"});
  const rediscovered=ingest({company:"Acme GmbH",title:"Product Lead",location:"Hamburg",url:"https://careers.example/jobs/1",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:changed",description:"Product Lead",contentStatus:"INSUFFICIENT"});
  expect(rediscovered).toMatchObject({created:false,upgraded:false});
  expect(rediscovered.job).toMatchObject({job_id:original.job.job_id,jd_original:"Rich factual description for the existing role.",content_status:"SUBSTANTIVE",canonical_url:"https://careers.example/jobs/1",canonical_source:"Careers"});
  expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:1});
  expect(db().prepare("SELECT url,source_name,is_canonical FROM job_sources").all()).toEqual([{url:"https://careers.example/jobs/1",source_name:"Careers",is_canonical:1}]);
 });
});

describe("V0.6.4 manual application status",()=>{
 it("renders persisted NOT_APPLIED and persists an explicit READY_TO_APPLY transition",async()=>{
  const job=ingest({company:"Acme",title:"Engineer",url:"https://careers.example/jobs/2",sourceName:"Careers",description:"TypeScript engineering"}).job;
  setReviewStatus(job.job_id,"INTERESTED");
  db().prepare("UPDATE jobs SET material_status='READY' WHERE id=?").run(job.id);
  expect(workflowQueues().materialsReady.map(j=>j.job_id)).toEqual([job.job_id]);
  const before=renderToStaticMarkup(await JobPage({params:Promise.resolve({id:job.job_id})}));
  expect(before).toContain('<option value="NOT_APPLIED" selected="">NOT APPLIED</option>');
  expect(before).toContain('<option value="READY_TO_APPLY">READY TO APPLY</option>');
  const form=new FormData();form.set("status","READY_TO_APPLY");
  const response=await POST(new Request(`http://localhost/api/jobs/${job.job_id}/application`,{method:"POST",body:form}),{params:Promise.resolve({id:job.job_id})});
  expect(response.status).toBe(303);
  expect(db().prepare("SELECT application_status FROM jobs WHERE id=?").get(job.id)).toEqual({application_status:"READY_TO_APPLY"});
  const after=renderToStaticMarkup(await JobPage({params:Promise.resolve({id:job.job_id})}));
  expect(after).toContain('<option value="READY_TO_APPLY" selected="">READY TO APPLY</option>');
  expect(workflowQueues().materialsReady).toEqual([]);
  expect(workflowQueues().readyToApply.map(j=>j.job_id)).toEqual([job.job_id]);
 });
 it("keeps invalid application-state validation",async()=>{
  const job=ingest({company:"Acme",title:"Engineer",url:"https://careers.example/jobs/3",sourceName:"Careers",description:"TypeScript engineering"}).job;
  const form=new FormData();form.set("status","INVALID");
  const response=await POST(new Request(`http://localhost/api/jobs/${job.job_id}/application`,{method:"POST",body:form}),{params:Promise.resolve({id:job.job_id})});
  expect(response.status).toBe(400);
  expect(await response.text()).toBe("Invalid application status");
 });
});
