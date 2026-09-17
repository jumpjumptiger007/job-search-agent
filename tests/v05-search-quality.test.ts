import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb,db } from "../lib/db";
import { ingest } from "../lib/jobs";
import { PersonioAdapter,isGermanyEligible,matchesPreferences,matchesRoleFamilies,recordSource,runDiscovery } from "../lib/discovery";

const file=path.join("/private/tmp","v05-search-quality.sqlite");
const store=path.join("/private/tmp","v05-search-quality-store");
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;process.env.JOB_AGENT_STORAGE_ROOT=store;fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
afterEach(()=>{closeDb();fs.rmSync(file,{force:true});fs.rmSync(store,{recursive:true,force:true});});
const job=(title="Product Manager",location?:string,description="")=>({company:"Acme",title,location,url:"https://example.com/job",sourceName:"Test",description});

describe("V0.5 Personio discovery",()=>{
  it("normalizes configured Personio positions with stable identities",async()=>{
    const original=globalThis.fetch;let requested="";
    globalThis.fetch=async input=>{requested=String(input);return new Response(JSON.stringify({data:[{id:42,name:"Product Manager",description:"<p>Build products</p>",office:{name:"Berlin, Germany"},createdAt:"2026-01-01"}]}));};
    try {const [found]=await new PersonioAdapter("acme").discover();expect(requested).toBe("https://acme.jobs.personio.com/api/v1/recruiting/positions?language=en");expect(found).toMatchObject({company:"acme",title:"Product Manager",location:"Berlin, Germany",url:"https://acme.jobs.personio.com/job/42",ats:"Personio",externalId:"personio:acme:42",description:"Build products"});recordSource(found);const first=ingest(found),second=ingest(found);expect(second.created).toBe(false);expect(db().prepare("SELECT identity,tenant FROM source_registry").all()).toEqual([{identity:"personio:acme",tenant:"acme"}]);expect(first.job.external_id).toBe("personio:acme:42");} finally {globalThis.fetch=original;}
  });

  it("accepts supported Personio URL forms and rejects non-Personio hosts",async()=>{
    const original=globalThis.fetch;let requested="";
    globalThis.fetch=async input=>{requested=String(input);return new Response(JSON.stringify({data:[{id:"de-1",name:"Product Manager"}]}));};
    try {const [found]=await new PersonioAdapter("https://ACME.jobs.personio.de/careers",undefined,"de").discover();expect(requested).toBe("https://acme.jobs.personio.de/api/v1/recruiting/positions?language=de");expect(found.externalId).toBe("personio:acme:de-1");expect(()=>new PersonioAdapter("https://acme.jobs.personio.com.example")).toThrow("Personio source");} finally {globalThis.fetch=original;}
  });

  it("skips malformed records and keeps Personio job URLs on the configured source",async()=>{
    const original=globalThis.fetch;
    globalThis.fetch=async()=>new Response(JSON.stringify({data:[null,{name:"Missing ID"},{id:"external",name:"External URL",url:"https://not-personio.example/job"},{id:"broken",name:"Broken URL",url:"https://["}]}));
    try {const jobs=await new PersonioAdapter("acme").discover();expect(jobs).toHaveLength(2);expect(jobs.map(found=>found.url)).toEqual(["https://acme.jobs.personio.com/job/external","https://acme.jobs.personio.com/job/broken"]);} finally {globalThis.fetch=original;}
  });

  it("treats empty or malformed position collections as no results",async()=>{
    const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:{}}));
    try {await expect(new PersonioAdapter("acme").discover()).resolves.toEqual([]);} finally {globalThis.fetch=original;}
  });

  it("isolates a Personio provider failure from other configured providers",async()=>{
    const cwd=process.cwd(),dir=fs.mkdtempSync(path.join("/private/tmp","v05-personio-run-")),original=globalThis.fetch;
    try {fs.mkdirSync(path.join(dir,"config"));fs.writeFileSync(path.join(dir,"config/preferences.yaml"),"discovery:\n  roleFamilies: [Product Management]\n  location: Germany\n");fs.writeFileSync(path.join(dir,"config/search.yaml"),"providers:\n  - type: personio\n    source: broken\n    enabled: true\n  - type: greenhouse\n    board: acme\n    enabled: true\n");process.chdir(dir);globalThis.fetch=async input=>String(input).includes("broken.jobs.personio")?new Response("unavailable",{status:503}):new Response(JSON.stringify({jobs:[{id:1,title:"Product Manager",absolute_url:"https://boards.greenhouse.io/acme/jobs/1",content:"Product role",location:{name:"Berlin, Germany"}}]}));const result=await runDiscovery("config/search.yaml");expect(result).toMatchObject({configured:2,failures:1,newJobs:1,seen:1});expect(result.errors[0]).toContain("Personio returned 503");} finally {globalThis.fetch=original;process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
  });

  it("records malformed Personio configuration without blocking other providers",async()=>{
    const cwd=process.cwd(),dir=fs.mkdtempSync(path.join("/private/tmp","v05-personio-config-")),original=globalThis.fetch;
    try {fs.mkdirSync(path.join(dir,"config"));fs.writeFileSync(path.join(dir,"config/preferences.yaml"),"discovery:\n  roleFamilies: [Product Management]\n");fs.writeFileSync(path.join(dir,"config/search.yaml"),"providers:\n  - type: personio\n    source: https://not-personio.example\n    enabled: true\n  - type: greenhouse\n    board: acme\n    enabled: true\n");process.chdir(dir);globalThis.fetch=async()=>new Response(JSON.stringify({jobs:[{id:1,title:"Product Manager",absolute_url:"https://boards.greenhouse.io/acme/jobs/1",content:"Product role"}]}));const result=await runDiscovery("config/search.yaml");expect(result).toMatchObject({configured:1,failures:1,newJobs:1,seen:1});expect(result.errors[0]).toContain("Personio configuration");} finally {globalThis.fetch=original;process.chdir(cwd);fs.rmSync(dir,{recursive:true,force:true});}
  });
});

describe("V0.5 Germany eligibility",()=>{
  it.each([
    ["Germany","Berlin, Germany",""],
    ["Germany remote","Remote, Germany",""],
    ["EU","Remote","Open to candidates anywhere in the EU."],
    ["Europe","Remote","Europe-wide role."],
    ["worldwide","Remote","Work worldwide."],
    ["ambiguous remote","Remote","Remote-first role."],
    ["missing location",undefined,"Product role."],
  ])("retains compatible or ambiguous %s",(_case,location,description)=>expect(isGermanyEligible(job("Product Manager",location,description))).toBe(true));
  it.each([
    ["US-only","Remote","This is a US-only role."],
    ["Canada-only","Remote","Canada-only role."],
    ["UK-only","Remote","UK-only role."],
    ["Switzerland-only","Remote","Switzerland-only role."],
    ["foreign residency","Remote","Applicants must reside in France."],
    ["plural foreign residency","Remote","Applicants must be residents in France."],
    ["required foreign residency","Remote","Residency in France is required."],
    ["explicit foreign role location","Remote","The role is based in Canada."],
    ["foreign authorization","Remote","Candidates must be authorized to work in Canada."],
    ["existing foreign authorization","Remote","Applicants must have existing work authorization in Canada."],
    ["required foreign authorization","Remote","Existing work authorization in the UK is required."],
    ["remote foreign location","Remote, Canada",""],
    ["Japan structured location","Tokyo, Japan",""],
    ["Australia structured location","Sydney, Australia • Melbourne, Australia",""],
    ["Singapore structured location","Singapore",""],
    ["non-European region","APAC",""],
    ["Europe excluding Germany","Remote","Remote in Europe excluding Germany."],
  ])("rejects explicit incompatible %s",(_case,location,description)=>expect(isGermanyEligible(job("Product Manager",location,description))).toBe(false));
  it("retains European locations, foreign country mentions, and mixed locations that are not requirements",()=>{expect(isGermanyEligible(job("Product Manager","Paris, France",""))).toBe(true);expect(isGermanyEligible(job("Product Manager","Remote","We support customers in Canada and Europe."))).toBe(true);expect(isGermanyEligible(job("Product Manager","Remote","You will be authorized to work in Canada after onboarding."))).toBe(true);expect(isGermanyEligible(job("Product Manager","Germany / Switzerland",""))).toBe(true);expect(isGermanyEligible(job("Product Manager","UK or Germany",""))).toBe(true);});
  it("uses the hardened check through Germany preferences",()=>expect(matchesPreferences(job("Product Manager","Berlin, Germany",""),{location:"Germany"})).toBe(true));
});

describe("V0.5 role relevance",()=>{
  const families=["Product Management"];
  it("keeps a clearly relevant title",()=>expect(matchesRoleFamilies(job("Product Manager","Berlin",""),families)).toBe(true));
  it("keeps adjacent title-led matches despite punctuation or plural forms",()=>{expect(matchesRoleFamilies(job("Product Owner","Berlin",""),families)).toBe(true);expect(matchesRoleFamilies(job("Product-Manager","Berlin",""),families)).toBe(true);});
  it("does not qualify generic management text in an unrelated JD",()=>expect(matchesRoleFamilies(job("Account Manager","Berlin","Experience with project management."),families)).toBe(false));
  it("does not let a generic management family qualify a JD by itself",()=>expect(matchesRoleFamilies(job("Account Manager","Berlin","Management experience required."),["Management"])).toBe(false));
  it("requires a title-led senior operations match when operations is the only family",()=>{expect(matchesRoleFamilies(job("Operations Associate","Berlin",""),["Operations"])).toBe(false);expect(matchesRoleFamilies(job("Operations Manager","Berlin",""),["Operations"])).toBe(true);});
  it("does not qualify generic operations text in an unrelated JD",()=>expect(matchesRoleFamilies(job("Software Engineer","Berlin","Partner with operations and project management."),families)).toBe(false));
  it("rejects unrelated manager and operations titles",()=>{expect(matchesRoleFamilies(job("Customer Success Manager","Berlin","Product management exposure."),families)).toBe(false);expect(matchesRoleFamilies(job("Operations Associate","Berlin","Product management exposure."),families)).toBe(false);});
  it("retains a plausible borderline role for human Review",()=>expect(matchesRoleFamilies(job("Product Specialist","Berlin","Support product management and roadmap planning."),families)).toBe(true));
});
