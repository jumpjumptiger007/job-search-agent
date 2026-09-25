import fs from "node:fs";
import { describe,expect,it } from "vitest";
import { closeDb } from "../lib/db";
import { ingest } from "../lib/jobs";
import { GreenhouseAdapter,LeverAdapter,matchesPreferences } from "../lib/discovery";
import { discoverGreenhouse,injectableCareerOpsTransport,loadCareerOpsProvider } from "../lib/integrations/career-ops";

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

  it("records the Lever parity blocker without changing the legacy adapter",async()=>{
    const raw={id:"posting-1",text:"Senior Engineer",hostedUrl:"https://jobs.lever.co/acme/posting-1",categories:{location:"Berlin, Germany"},descriptionPlain:"Core description",additionalPlain:"Additional requirements",workplaceType:"remote"};
    const provider=await loadCareerOpsProvider("lever"),upstream=await provider.fetch({name:"acme",api:"https://api.lever.co/v0/postings/acme"},providerTransport([raw]));
    const original=globalThis.fetch; globalThis.fetch=async()=>new Response(JSON.stringify([raw]));
    try { const [legacy]=await new LeverAdapter("acme").discover(); expect(legacy).toMatchObject({externalId:"lever:acme:posting-1",description:"Core description\nAdditional requirements",workModel:"remote"}); expect(upstream[0]).toMatchObject({description:"Core description"}); expect(upstream[0]).not.toHaveProperty("workModel"); expect(upstream[0].description).not.toContain("Additional requirements"); }
    finally { globalThis.fetch=original; }
  });
});
