import { afterEach,describe,expect,it } from "vitest";
import { BundesagenturAdapter } from "../lib/discovery";
import { injectableCareerOpsTransport } from "../lib/integrations/career-ops";

const preferences={roleFamilies:["Softwareentwickler"],location:"Germany"};
const record={stellenangebotsTitel:"Softwareentwickler (m/w/d)",firma:"Deutsche Rentenversicherung Bund (DRV Bund)",stellenlokationen:[{adresse:{ort:"Würzburg",plz:"97084",land:"DEUTSCHLAND"}}],referenznummer:"14225-9b2ce6645fccdfb3-S",datumErsteVeroeffentlichung:"2026-09-16"};
afterEach(()=>{delete process.env.BA_API_KEY;});

describe("Bundesagentur v0.7 provider cutover",()=>{
  it("uses the pinned v6 provider once, removes v4 detail, and maps canonical identity/content",async()=>{
    process.env.BA_API_KEY="legacy-host-key";
    let calls=0;const transport=injectableCareerOpsTransport({fetchJson:async(url,options)=>{calls++;expect(url).toContain("/pc/v6/jobs?");expect(new URL(url).searchParams.get("wo")).toBeNull();expect(new URL(url).searchParams.get("veroeffentlichtseit")).toBe("1000");expect((options as any).headers).toEqual({"X-API-Key":"jobboerse-jobsuche",accept:"application/json"});return{ergebnisliste:[record]};},fetchText:async()=>"",fetchResponse:async()=>new Response()});
    const [job]=await new BundesagenturAdapter(preferences,25,transport).discover();expect(calls).toBe(1);expect(job).toMatchObject({company:record.firma,title:record.stellenangebotsTitel,location:"Würzburg",url:`https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(record.referenznummer)}`,externalId:`ba:${record.referenznummer}`,contentStatus:"INSUFFICIENT",discoveredVia:"Bundesagentur für Arbeit"});
  });
  it("queries unique role families, deduplicates by reference, and applies a total host limit",async()=>{
    const requested:string[]=[];const rows=[record,{...record,referenznummer:"second",stellenangebotsTitel:"Product Developer",firma:"Second GmbH"},{...record,referenznummer:"third",stellenangebotsTitel:"IoT Developer",firma:"Third GmbH"}];const transport=injectableCareerOpsTransport({fetchJson:async url=>{const role=new URL(url).searchParams.get("was")||"";requested.push(role);return{ergebnisliste:role==="First"?[rows[0],rows[1]]:[rows[0],rows[2]]};},fetchText:async()=>"",fetchResponse:async()=>new Response()});
    const jobs=await new BundesagenturAdapter({roleFamilies:["First","First","Second"]},2,transport).discover();expect(requested).toEqual(["First","Second"]);expect(jobs.map(job=>job.externalId)).toEqual([`ba:${record.referenznummer}`,"ba:second"]);
  });
  it("preserves pinned partial/total provider error behavior",async()=>{const rejected=injectableCareerOpsTransport({fetchJson:async()=>{throw new Error("HTTP 403");},fetchText:async()=>"",fetchResponse:async()=>new Response()});await expect(new BundesagenturAdapter(preferences,25,rejected).discover()).rejects.toThrow("HTTP 403");});
});
