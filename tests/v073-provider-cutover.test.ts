import fs from "node:fs";
import { describe,expect,it } from "vitest";
import { closeDb } from "../lib/db";
import { ingest } from "../lib/jobs";
import { GreenhouseAdapter,LeverAdapter,PersonioAdapter,matchesPreferences } from "../lib/discovery";
import { discoverGreenhouse,discoverLever,discoverPersonio,injectableCareerOpsTransport } from "../lib/integrations/career-ops";

const greenhouse = {id:42,title:"Senior Engineer",absolute_url:"https://boards.greenhouse.io/acme/jobs/42",location:{name:"Berlin, Germany"},content:"<p>Build reliable services for Germany.</p>",updated_at:"2026-09-01",first_published:"2026-08-30"};
const transport = (body:unknown) => injectableCareerOpsTransport({fetchJson:async url=>{expect(url).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true");return body;},fetchText:async()=>"",fetchResponse:async()=>new Response()});
const providerTransport = (body:unknown) => injectableCareerOpsTransport({fetchJson:async()=>body,fetchText:async()=>"",fetchResponse:async()=>new Response()});

describe("V0.7.3 sequential provider cutover",()=>{
  it("routes Greenhouse through Career Ops with host config, identity, filtering, limits, and deliberate published-date semantics",async()=>{
    const rows = await discoverGreenhouse("acme",1,transport({jobs:[greenhouse,{...greenhouse,id:43,absolute_url:"https://boards.greenhouse.io/acme/jobs/43"}]}));
    expect(rows).toEqual([expect.objectContaining({company:"acme",title:"Senior Engineer",location:"Berlin, Germany",url:greenhouse.absolute_url,sourceName:"Greenhouse",ats:"Greenhouse",externalId:"greenhouse:acme:42",description:"Build reliable services for Germany.",contentStatus:"SUBSTANTIVE",postedAt:"2026-08-30T00:00:00.000Z",discoveredVia:"configured ATS"})]);
    expect(matchesPreferences(rows[0],{roleFamilies:["Engineer"],location:"Germany"})).toBe(true);
  });

  it("propagates pinned Greenhouse provider failures and keeps legacy IDs convergent",async()=>{
    const rejected=injectableCareerOpsTransport({fetchJson:async()=>{throw new Error("HTTP 503");},fetchText:async()=>"",fetchResponse:async()=>new Response()});
    await expect(discoverGreenhouse("acme",undefined,rejected)).rejects.toThrow("HTTP 503");
    const file="/private/tmp/v073-provider-cutover.sqlite"; process.env.JOB_AGENT_DB_PATH=file; closeDb();
    try { const legacy=ingest({company:"acme",title:"Senior Engineer",location:"Berlin, Germany",url:greenhouse.absolute_url,sourceName:"Greenhouse",ats:"Greenhouse",externalId:"greenhouse:acme:42",description:"legacy",contentStatus:"SUBSTANTIVE"}); const [found]=await discoverGreenhouse("acme",1,transport({jobs:[greenhouse]})); const rediscovered=ingest(found); expect(rediscovered).toMatchObject({created:false}); expect(rediscovered.job.job_id).toBe(legacy.job.job_id); }
    finally { closeDb(); delete process.env.JOB_AGENT_DB_PATH; fs.rmSync(file,{force:true}); }
  });

  it("routes Lever through one pinned-provider request while retaining matched host compatibility fields",async()=>{
    const raw={id:"posting-1",text:"Senior Engineer",hostedUrl:"https://jobs.lever.co/acme/posting-1",categories:{location:"Berlin, Germany",allLocations:["Berlin, Germany","Munich, Germany"]},descriptionPlain:"Core description",additionalPlain:"Additional requirements",workplaceType:"remote",createdAt:0};
    let calls=0; const leverTransport=injectableCareerOpsTransport({fetchJson:async url=>{calls++;expect(url).toBe("https://api.lever.co/v0/postings/acme");return[raw];},fetchText:async()=>"",fetchResponse:async()=>new Response()});
    const original=globalThis.fetch; globalThis.fetch=async()=>{throw new Error("cut-over adapter must not fetch directly");};
    try { const [found]=await new LeverAdapter("acme",1,leverTransport).discover(); expect(calls).toBe(1); expect(found).toMatchObject({company:"acme",title:"Senior Engineer",url:raw.hostedUrl,location:"Berlin, Germany; Munich, Germany",sourceName:"Lever",ats:"Lever",externalId:"lever:acme:posting-1",description:"Core description\nAdditional requirements",workModel:"remote",postedAt:"1970-01-01T00:00:00.000Z",discoveredVia:"configured ATS"}); expect(matchesPreferences(found,{remotePreference:"remote"})).toBe(true); }
    finally { globalThis.fetch=original; }
  });

  it("requires an unambiguous raw Lever match for compatibility fields and preserves legacy permanent IDs",async()=>{
    const raw={id:"posting-1",text:"Senior Engineer",hostedUrl:"https://jobs.lever.co/acme/posting-1",categories:{location:"Berlin, Germany"},descriptionPlain:"Core description",additionalPlain:"Additional requirements",workplaceType:"remote"};
    const duplicate={...raw,id:"posting-2"},ambiguous=await discoverLever("acme",undefined,providerTransport([raw,duplicate]));
    expect(ambiguous.every(job=>!job.externalId&&!job.workModel&&job.description==="Core description")).toBe(true);
    const file="/private/tmp/v073-lever-cutover.sqlite"; process.env.JOB_AGENT_DB_PATH=file; closeDb();
    try { const legacy=ingest({company:"acme",title:"Senior Engineer",location:"Berlin, Germany",url:raw.hostedUrl,sourceName:"Lever",ats:"Lever",externalId:"lever:acme:posting-1",description:"Core description\nAdditional requirements",workModel:"remote",contentStatus:"SUBSTANTIVE"}); const [found]=await discoverLever("acme",1,providerTransport([raw])); const rediscovered=ingest(found); expect(rediscovered).toMatchObject({created:false}); expect(rediscovered.job.job_id).toBe(legacy.job.job_id); }
    finally { closeDb(); delete process.env.JOB_AGENT_DB_PATH; fs.rmSync(file,{force:true}); }
  });

  it("propagates Lever transport failures",async()=>{
    const rejected=injectableCareerOpsTransport({fetchJson:async()=>{throw new Error("HTTP 503");},fetchText:async()=>"",fetchResponse:async()=>new Response()});
    await expect(new LeverAdapter("acme",undefined,rejected).discover()).rejects.toThrow("HTTP 503");
  });

  it("routes Personio through the pinned provider, retaining only observed XML fields for numeric accepted rows",async()=>{
    const xml=`<workzag-jobs><position><id>42</id><name>Senior Engineer</name><office>Berlin, Germany</office><jobDescriptions><![CDATA[<p>Build reliable services for Germany.</p>]]></jobDescriptions><employmentType>remote</employmentType></position><position><id>43</id><name>Second Engineer</name><office>Munich, Germany</office></position><position><id>legacy-id</id><name>Unsupported legacy fixture</name><office>Berlin, Germany</office></position></workzag-jobs>`;
    let calls=0; const personioTransport=injectableCareerOpsTransport({fetchJson:async()=>{throw new Error("unexpected JSON");},fetchText:async(url,options)=>{calls++;expect(url).toBe("https://acme.jobs.personio.de/xml");expect(options).toEqual({redirect:"error"});return xml;},fetchResponse:async()=>new Response()});
    const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error("cut-over adapter must not fetch directly");};
    try { const [found]=await new PersonioAdapter("https://ACME.jobs.personio.de/careers",1,"de","Acme GmbH",personioTransport).discover(); expect(calls).toBe(1);expect(found).toMatchObject({company:"Acme GmbH",title:"Senior Engineer",location:"Berlin, Germany",url:"https://acme.jobs.personio.de/job/42",sourceName:"Personio",ats:"Personio",externalId:"personio:acme:42",description:"Build reliable services for Germany.",contentStatus:"SUBSTANTIVE",workModel:"remote",discoveredVia:"configured ATS"});expect(matchesPreferences(found,{location:"Germany",remotePreference:"remote"})).toBe(true); }
    finally {globalThis.fetch=original;}
  });

  it("makes Personio validation, language supersession, unsupported IDs, errors, and permanent identity convergence explicit",async()=>{
    const numeric=`<workzag-jobs><position><id>42</id><name>Senior Engineer</name><office>Berlin, Germany</office></position><position><id>legacy-id</id><name>Legacy fixture</name><office>Berlin, Germany</office></position></workzag-jobs>`;
    let requested="";const personioTransport=injectableCareerOpsTransport({fetchJson:async()=>null,fetchText:async url=>{requested=url;return numeric;},fetchResponse:async()=>new Response()});
    const rows=await discoverPersonio("https://acme.jobs.personio.com",undefined,undefined,personioTransport);expect(requested).toBe("https://acme.jobs.personio.com/xml");expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({externalId:"personio:acme:42",contentStatus:"INSUFFICIENT"});expect(()=>new PersonioAdapter("http://acme.jobs.personio.de")).toThrow("explicit public");expect(()=>new PersonioAdapter("https://acme.jobs.personio.fr")).toThrow("explicit public");
    const rejected=injectableCareerOpsTransport({fetchJson:async()=>null,fetchText:async()=>{throw new Error("HTTP 503");},fetchResponse:async()=>new Response()});await expect(discoverPersonio("https://acme.jobs.personio.de",undefined,undefined,rejected)).rejects.toThrow("HTTP 503");
    const file="/private/tmp/v073-personio-cutover.sqlite";process.env.JOB_AGENT_DB_PATH=file;closeDb();try {const legacy=ingest({company:"acme",title:"Senior Engineer",location:"Berlin, Germany",url:"https://acme.jobs.personio.com/job/42",sourceName:"Personio",ats:"Personio",externalId:"personio:acme:42",description:"legacy",contentStatus:"SUBSTANTIVE"});const [found]=await discoverPersonio("https://acme.jobs.personio.com",undefined,1,personioTransport);const rediscovered=ingest(found);expect(rediscovered).toMatchObject({created:false});expect(rediscovered.job.job_id).toBe(legacy.job.job_id);}finally{closeDb();delete process.env.JOB_AGENT_DB_PATH;fs.rmSync(file,{force:true});}
  });
});
