import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb,db } from "../lib/db";
import { ingest,setReviewStatus } from "../lib/jobs";
import { persistJobAnalysis } from "../lib/agent-workflow";
import { generateMaterials,materialArtifacts } from "../lib/materials";
import { fakeRenderCV } from "./rendercv-runner";

const file="/private/tmp/v077-job-artifacts.sqlite",store="/private/tmp/v077-job-artifacts-store";
const analysis=(jobId:string)=>({schemaVersion:"v0.7",jobId,role:{archetype:"Engineer"},requirements:[{text:"TypeScript",evidence:"TypeScript"}],matches:[{requirement:"TypeScript",candidateFactRefs:[{kind:"skill",index:0}]}],gaps:[],germanyDachConsiderations:[],strengths:[{kind:"skill",index:0}],keywords:[{text:"TypeScript",priority:1,evidence:"TypeScript"}],tailoringPlan:{skillIndexes:[0],experiences:[],keywords:["TypeScript"]},evaluation:{score:4},provenance:{candidateSource:"profile/profile.yaml",approvedFactRefs:[{kind:"skill",index:0}]},unsupportedClaims:[]});
const add=()=>ingest({company:"Acme",title:"Engineer",url:"https://careers.example/gate-7",sourceName:"Careers",description:"TypeScript engineering"}).job;

beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("v0.7 Gate 7 job artifact ownership",()=>{
 it("ingests SQLite state without creating a job folder or legacy mirrors",()=>{const job=add();expect(db().prepare("SELECT job_id,jd_original,analysis_json FROM jobs WHERE id=?").get(job.id)).toEqual({job_id:job.job_id,jd_original:"TypeScript engineering",analysis_json:null});expect(fs.existsSync(path.join(store,"jobs"))).toBe(false);});
 it("persists a substantive BA source upgrade in SQLite without writing mirrors",()=>{const initial=ingest({company:"Acme",title:"Engineer",url:"https://arbeitsagentur.example/1",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:gate-7",description:"Engineer",contentStatus:"INSUFFICIENT"});const upgraded=ingest({company:"Acme",title:"Engineer",url:"https://arbeitsagentur.example/1",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:gate-7",description:"Rich TypeScript engineering description.",contentStatus:"SUBSTANTIVE"});expect(upgraded).toMatchObject({created:false,upgraded:true});expect(db().prepare("SELECT content_status,jd_original,analysis_json FROM jobs WHERE id=?").get(initial.job.id)).toEqual({content_status:"SUBSTANTIVE",jd_original:"Rich TypeScript engineering description.",analysis_json:null});expect(fs.existsSync(path.join(store,"jobs"))).toBe(false);});
 it("creates only expected application artifacts on material generation",async()=>{fs.mkdirSync(path.join(store,"profile"),{recursive:true});fs.writeFileSync(path.join(store,"profile","profile.yaml"),"name: Test Candidate\nskills: [TypeScript]\nsummary: Factual test summary.\n");const job=add();setReviewStatus(job.job_id,"INTERESTED");persistJobAnalysis(job.job_id,analysis(job.job_id));await generateMaterials(job.job_id,await fakeRenderCV());const directory=path.join(store,job.folder_path),files=materialArtifacts(job).map(({file})=>path.relative(directory,file)).sort();expect(files).toEqual(["cover_letter/cover_letter.docx","cover_letter/cover_letter.pdf","package/application_package.pdf","resume/rendercv.yaml","resume/resume.pdf"]);for(const mirror of ["job.json","jd_original.md","analysis.md"])expect(fs.existsSync(path.join(directory,mirror))).toBe(false);});
});
