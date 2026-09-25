import fs from "node:fs";
import path from "node:path";

const storageRoot=()=>process.env.JOB_AGENT_STORAGE_ROOT||process.cwd();
export function jobFolder(id:string, company:string,title:string){ return path.join("jobs",`${id}_${`${company}_${title}`.replace(/[^a-z0-9]+/gi,"_").replace(/^_|_$/g,"").slice(0,80)}`); }
export function writeJobFiles(job:any){ const dir=path.join(storageRoot(),job.folder_path); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,"jd_original.md"),`# Captured job description\n\n- Source: ${job.canonical_source}\n- URL: ${job.canonical_url}\n- Captured: ${job.found_at}\n\n---\n\n${job.jd_original}`); fs.writeFileSync(path.join(dir,"job.json"),JSON.stringify({jobId:job.job_id,company:job.company,title:job.title,canonicalSource:job.canonical_source,url:job.canonical_url,ats:job.ats,postedAt:job.posted_at},null,2)); fs.writeFileSync(path.join(dir,"analysis.md"),"Analysis pending. Use the repository job-agent Skill with a factual private profile.\n"); }
