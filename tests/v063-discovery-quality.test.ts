import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { closeDb, db } from "../lib/db";
import { BundesagenturAdapter, loadDiscoveryPreferences, matchesPreferences } from "../lib/discovery";
import { ingest, setReviewStatus, workflowQueues } from "../lib/jobs";
import { generateMaterials } from "../lib/materials";

const file=path.join("/private/tmp","v063-quality.sqlite"),store=path.join("/private/tmp","v063-quality-store"),preferences={roleFamilies:["Product Manager"],location:"Germany"};
const job=(title:string)=>({company:"Acme",title,url:"https://example.test/job",sourceName:"Test",description:"Relevant role with German language requirements."});
const detail="Own product strategy, lead cross-functional delivery, and define measurable customer outcomes with stakeholders across the business.";
const record={stellenangebotsTitel:"Senior Product Manager",firma:"Acme",referenznummer:"legacy-ba-1",stellenlokationen:[{adresse:{ort:"Berlin"}}]};

beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();delete process.env.BA_API_KEY;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("v0.6.3 seniority filtering",()=>{
  const p={seniority:["mid","senior"]};
  it.each(["Werkstudent Product Manager","Praktikant Digital","Junior Engineer","Working Student Analyst","Entry-level Developer"])("rejects %s",title=>expect(matchesPreferences(job(title),p)).toBe(false));
  it.each(["Senior Product Manager","Mid-level Engineer","Product Manager"])("retains %s",title=>expect(matchesPreferences(job(title),p)).toBe(true));
  it("preserves no preference",()=>expect(matchesPreferences(job("Werkstudent Product Manager"),{})).toBe(true));
});

describe("v0.6.3 BA detail capture and rediscovery",()=>{
  const withFetch=async(response:Response|undefined,run:()=>Promise<void>)=>{const original=globalThis.fetch;globalThis.fetch=async(input:any)=>String(input).includes("/v6/jobs")?new Response(JSON.stringify({ergebnisliste:[record]})):response||new Response("unavailable",{status:503});try{await run();}finally{globalThis.fetch=original;}};
  it("captures substantive bounded detail",async()=>withFetch(new Response(JSON.stringify({stellenangebotsBeschreibung:detail})),async()=>{const [result]=await new BundesagenturAdapter(preferences,1).discover();expect(result.contentStatus).toBe("SUBSTANTIVE");expect(result.description).toContain("Own product strategy");}));
  it("upgrades a persisted title-only BA job without changing its permanent identity or adding a duplicate",async()=>withFetch(new Response(JSON.stringify({stellenangebotsBeschreibung:detail})),async()=>{
    const legacy=ingest({company:"Acme",title:record.stellenangebotsTitel,location:"Berlin",url:"https://www.arbeitsagentur.de/jobsuche/suche?was=legacy",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:legacy-ba-1",description:record.stellenangebotsTitel,contentStatus:"INSUFFICIENT"});
    const [rediscovered]=await new BundesagenturAdapter(preferences,1).discover();
    const upgraded=ingest(rediscovered);
    expect(upgraded).toMatchObject({created:false,upgraded:true});
    expect(upgraded.job.job_id).toBe(legacy.job.job_id);
    expect(db().prepare("SELECT count(*) AS n FROM jobs").get()).toEqual({n:1});
    expect(upgraded.job).toMatchObject({content_status:"SUBSTANTIVE",jd_original:detail});
    setReviewStatus(upgraded.job.job_id,"INTERESTED");
    expect(workflowQueues().tailor.map(job=>job.job_id)).toEqual([legacy.job.job_id]);
  }));
  it("never downgrades richer BA detail and keeps failed detail retrieval reviewable and blocked",async()=>{
    const existing=ingest({company:"Acme",title:record.stellenangebotsTitel,location:"Berlin",url:"https://www.arbeitsagentur.de/jobsuche/suche?was=legacy",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:legacy-ba-1",description:detail,contentStatus:"SUBSTANTIVE"});
    const poorer=ingest({...existing.job,company:"Acme",title:record.stellenangebotsTitel,url:"https://example.test/duplicate",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:legacy-ba-1",description:"",contentStatus:"INSUFFICIENT"});
    expect(poorer.job).toMatchObject({job_id:existing.job.job_id,content_status:"SUBSTANTIVE",jd_original:detail});
    const insufficient=ingest({company:"Beta",title:"Werkstudent Product Manager",location:"Berlin",url:"https://example.test/failed-detail",sourceName:"Bundesagentur für Arbeit",ats:"BA",externalId:"ba:failed-detail",description:"Werkstudent Product Manager",contentStatus:"INSUFFICIENT"});
    const original=globalThis.fetch;
    globalThis.fetch=async(input:any)=>String(input).includes("/v6/jobs")?new Response(JSON.stringify({ergebnisliste:[{...record,stellenangebotsTitel:"Werkstudent Product Manager",firma:"Beta",referenznummer:"failed-detail"}]})):new Response("unavailable",{status:503});
    const [failedDetail]=await new BundesagenturAdapter(preferences,1).discover();
    globalThis.fetch=original;
    const failed=ingest(failedDetail);
    expect(failed.job).toMatchObject({job_id:insufficient.job.job_id,content_status:"INSUFFICIENT",review_status:"PENDING"});
    expect(workflowQueues().review.map(job=>job.job_id)).toContain(insufficient.job.job_id);
    setReviewStatus(insufficient.job.job_id,"INTERESTED");
    expect(workflowQueues().tailor.map(job=>job.job_id)).not.toContain(insufficient.job.job_id);
    await expect(generateMaterials(failed.job.job_id)).rejects.toThrow("INSUFFICIENT_SOURCE_CONTENT");
  });
});

describe("v0.6.3 discovery configuration",()=>{
  it("loads seniority only from the discovery section",()=>{
    const config=path.join("/private/tmp","v063-preferences.yaml");
    fs.writeFileSync(config,"candidate:\n  seniority: [junior]\ndiscovery:\n  seniority: [mid, senior]\n");
    try{expect(loadDiscoveryPreferences(config).seniority).toEqual(["mid","senior"]);}finally{fs.rmSync(config,{force:true});}
  });
});

describe("v0.6.3 content-status migration safety",()=>{
  it("keeps a title-only legacy BA job reviewable without treating old material state as current",()=>{
    closeDb();
    const legacy=new Database(file);
    legacy.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); CREATE TABLE jobs (id INTEGER PRIMARY KEY, ats TEXT, jd_original TEXT, title TEXT, material_status TEXT, application_status TEXT, score INTEGER, score_explanation TEXT, status TEXT, review_status TEXT, skipped INTEGER);");
    for(let version=1;version<=7;version++)legacy.prepare("INSERT INTO schema_migrations(version,applied_at) VALUES(?,CURRENT_TIMESTAMP)").run(version);
    legacy.prepare("INSERT INTO jobs(id,ats,jd_original,title,material_status,application_status,score,status,review_status,skipped) VALUES(1,'BA','Werkstudent Product Manager','Werkstudent Product Manager','READY','READY_TO_APPLY',75,'MATERIAL_GENERATED','INTERESTED',0)").run();
    legacy.close();
    expect(db().prepare("SELECT content_status,material_status,application_status,score,status,review_status FROM jobs WHERE id=1").get()).toEqual({content_status:"INSUFFICIENT",material_status:"NOT_GENERATED",application_status:"NOT_APPLIED",score:null,status:"DISCOVERED",review_status:"INTERESTED"});
  });
});
