import crypto from "node:crypto"; import fs from "node:fs"; import path from "node:path";
import { db } from "./db"; import type { ApplicationStatus, DiscoveredJob, ReviewStatus } from "./types";
const norm=(v="")=>v.toLowerCase().replace(/https?:\/\/(www\.)?/,'').replace(/[^a-z0-9]+/g,' ').trim();
const hash=(v:string)=>crypto.createHash("sha256").update(norm(v)).digest("hex");
const official=(s:string)=>/greenhouse|lever|ashby|personio|workday|smartrecruiters|successfactors|career|careers/i.test(s);
const storageRoot=()=>process.env.JOB_AGENT_STORAGE_ROOT||process.cwd();
function folder(id:string, company:string,title:string){ return path.join("jobs",`${id}_${`${company}_${title}`.replace(/[^a-z0-9]+/gi,"_").replace(/^_|_$/g,"").slice(0,80)}`); }
export function selectCanonical(a:{url:string;sourceName:string},b:{url:string;sourceName:string}) { return official(b.sourceName+" "+b.url) && !official(a.sourceName+" "+a.url) ? b : a; }
export function ingest(job:DiscoveredJob) {
 const d=db(), jdHash=hash(job.description), key=[norm(job.company),norm(job.title),norm(job.location)].join("|");
 let existing=job.externalId ? d.prepare("SELECT * FROM jobs WHERE external_id=?").get(job.externalId) as any : undefined;
 if(!existing) existing=d.prepare("SELECT * FROM jobs WHERE lower(company)=? AND lower(title)=? AND ifnull(lower(location),'')=?").get(job.company.toLowerCase(),job.title.toLowerCase(),(job.location||'').toLowerCase()) as any;
 if(!existing) existing=d.prepare("SELECT * FROM jobs WHERE jd_hash=?").get(jdHash) as any;
 if(existing) { const canonical=selectCanonical({url:existing.canonical_url,sourceName:existing.canonical_source},{url:job.url,sourceName:job.sourceName}); d.prepare("INSERT OR IGNORE INTO job_sources(job_id,url,source_name,is_canonical) VALUES(?,?,?,0)").run(existing.id,job.url,job.sourceName); if(canonical.url===job.url) d.prepare("UPDATE jobs SET canonical_url=?, canonical_source=?, ats=coalesce(?,ats), updated_at=CURRENT_TIMESTAMP WHERE id=?").run(job.url,job.sourceName,job.ats,existing.id); d.prepare("UPDATE job_sources SET is_canonical=CASE WHEN url=? THEN 1 ELSE 0 END WHERE job_id=?").run(canonical.url,existing.id); d.prepare("INSERT INTO audit_events(job_id,action,detail) VALUES(?,?,?)").run(existing.id,"SOURCE_DEDUPLICATED",JSON.stringify({url:job.url,key})); return {job: d.prepare("SELECT * FROM jobs WHERE id=?").get(existing.id), created:false}; }
 const next=(d.prepare("UPDATE job_id_sequence SET last_value=last_value+1 WHERE singleton=1 RETURNING last_value").get() as {last_value:number}).last_value; const jobId=`JOB-${String(next).padStart(4,"0")}`; const dir=folder(jobId,job.company,job.title); fs.mkdirSync(path.join(storageRoot(),dir),{recursive:true});
 const info=d.prepare("INSERT INTO jobs(job_id,company,title,location,work_model,posted_at,canonical_url,canonical_source,ats,external_id,jd_original,jd_hash,folder_path) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(jobId,job.company,job.title,job.location||null,job.workModel||null,job.postedAt||null,job.url,job.sourceName,job.ats||null,job.externalId||null,job.description,jdHash,dir);
 const saved=d.prepare("SELECT * FROM jobs WHERE id=?").get(info.lastInsertRowid) as any; d.prepare("INSERT INTO job_sources(job_id,url,source_name,is_canonical) VALUES(?,?,?,1)").run(saved.id,job.url,job.sourceName); writeJobFiles(saved); d.prepare("INSERT INTO audit_events(job_id,action,detail) VALUES(?,?,?)").run(saved.id,"DISCOVERED",JSON.stringify({key})); return {job:saved,created:true};
}
export function writeJobFiles(job:any){ const dir=path.join(storageRoot(),job.folder_path); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,"jd_original.md"),`# Captured job description\n\n- Source: ${job.canonical_source}\n- URL: ${job.canonical_url}\n- Captured: ${job.found_at}\n\n---\n\n${job.jd_original}`); fs.writeFileSync(path.join(dir,"job.json"),JSON.stringify({jobId:job.job_id,company:job.company,title:job.title,canonicalSource:job.canonical_source,url:job.canonical_url,ats:job.ats,postedAt:job.posted_at},null,2)); fs.writeFileSync(path.join(dir,"analysis.md"),job.score_explanation||"Analysis pending. Add a factual candidate profile and scoring configuration.\n"); }
export function listJobs(){return db().prepare("SELECT * FROM jobs ORDER BY priority DESC, found_at DESC").all() as any[];}
export function getJob(id:string){return db().prepare("SELECT * FROM jobs WHERE job_id=?").get(id) as any;}
export function setReviewStatus(jobId:string, reviewStatus:ReviewStatus) {
 const d=db(), job=getJob(jobId); if(!job) throw new Error("Job not found");
 d.prepare("UPDATE jobs SET review_status=?, skipped=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(reviewStatus,reviewStatus==="SKIPPED"?1:0,job.id);
 d.prepare("INSERT INTO audit_events(job_id,action,detail) VALUES(?,?,?)").run(job.id,`REVIEW_${reviewStatus}`,JSON.stringify({from:job.review_status,to:reviewStatus}));
 return getJob(jobId);
}
const applicationStates:ApplicationStatus[]=["NOT_APPLIED","READY_TO_APPLY","APPLIED","INTERVIEW","REJECTED","OFFER","WITHDRAWN"];
export function setApplicationStatus(jobId:string, applicationStatus:ApplicationStatus) {
 const d=db(), job=getJob(jobId); if(!job) throw new Error("Job not found");
 if(!applicationStates.includes(applicationStatus)) throw new Error("Invalid application status");
 if(applicationStatus==="READY_TO_APPLY"&&(job.review_status!=="INTERESTED"||job.material_status!=="READY")) throw new Error("Materials must be ready for an interested job before it can be ready to apply");
 d.prepare("UPDATE jobs SET application_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(applicationStatus,job.id);
 d.prepare("INSERT INTO audit_events(job_id,action,detail) VALUES(?,?,?)").run(job.id,"APPLICATION_STATUS_CHANGED",JSON.stringify({from:job.application_status,to:applicationStatus}));
 return getJob(jobId);
}
