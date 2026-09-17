import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb,db } from "../lib/db";
import { WebSearchAdapter,runDiscovery } from "../lib/discovery";

const file=path.join("/private/tmp","v061-maintenance.sqlite"),store=path.join("/private/tmp","v061-maintenance-store");
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});

describe("V0.6.1 discovery maintenance",()=>{
  it("retries one transient Web-search fetch failure",async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{if(++calls===1)throw new TypeError("fetch failed");return new Response('<li class="b_algo"><h2><a href="https://careers.acme.example/jobs/1">Engineer</a></h2></li>');};try{await expect(new WebSearchAdapter({roleFamilies:["Engineer"],location:"Germany"},{maxQueries:1,maxRawCandidates:1,maxProcessedCandidates:1}).discover()).resolves.toHaveLength(1);expect(calls).toBe(2);}finally{globalThis.fetch=original;}});
  it.each([["zero",[],{upstreamCandidates:0,filteredCandidates:0,seen:0}],["filtered",[{id:1,title:"Engineer",absolute_url:"https://boards.greenhouse.io/acme/jobs/1",content:"Applicants must be currently authorized to work in the United States",location:{name:"Anywhere in the United States"}}],{upstreamCandidates:1,filteredCandidates:1,seen:0}]])("records %s discovery diagnostics",async(_case,jobs,expected)=>{const cwd=process.cwd(),dir=fs.mkdtempSync(path.join("/private/tmp","v061-discovery-")),original=globalThis.fetch;try{fs.mkdirSync(path.join(dir,"config"));fs.writeFileSync(path.join(dir,"config/preferences.yaml"),"discovery:\n  roleFamilies: [Engineer]\n  location: Germany\n");fs.writeFileSync(path.join(dir,"config/search.yaml"),"providers:\n  - type: greenhouse\n    board: acme\n    enabled: true\n");process.chdir(dir);globalThis.fetch=async()=>new Response(JSON.stringify({jobs}));const result=await runDiscovery("config/search.yaml");expect(result).toMatchObject(expected);expect(db().prepare("SELECT upstream_candidates,filtered_candidates,accepted_candidates,jobs_seen FROM discovery_runs").get()).toEqual({upstream_candidates:expected.upstreamCandidates,filtered_candidates:expected.filteredCandidates,accepted_candidates:expected.seen,jobs_seen:expected.seen});}finally{globalThis.fetch=original;process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}});
});
