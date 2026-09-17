import { afterEach,describe,expect,it } from "vitest";
import { BundesagenturAdapter } from "../lib/discovery";

const preferences={roleFamilies:["Softwareentwickler"],location:"Germany"};
const record={stellenangebotsTitel:"Softwareentwickler (m/w/d)",firma:"Deutsche Rentenversicherung Bund (DRV Bund)",stellenlokationen:[{adresse:{ort:"Würzburg",plz:"97084",land:"DEUTSCHLAND"}}],referenznummer:"14225-9b2ce6645fccdfb3-S",datumErsteVeroeffentlichung:"2026-09-16",externeURL:"https://example.invalid/job"};
afterEach(()=>{delete process.env.BA_API_KEY;});

describe("Bundesagentur v6 compatibility",()=>{
  it("maps the v6 response schema and sends the API key",async()=>{const original=globalThis.fetch;let requested="",headers:any;process.env.BA_API_KEY="jobboerse-jobsuche";globalThis.fetch=async(input:any,init:any)=>{requested=String(input);headers=init.headers;return new Response(JSON.stringify({ergebnisliste:[record]}));};try{const [job]=await new BundesagenturAdapter(preferences,25).discover();expect(requested).toContain("/jobboerse/jobsuche-service/pc/v6/jobs");expect(headers).toEqual({"X-API-Key":"jobboerse-jobsuche"});expect(job).toMatchObject({company:record.firma,title:record.stellenangebotsTitel,location:"Würzburg",externalId:`ba:${record.referenznummer}`,postedAt:record.datumErsteVeroeffentlichung});expect(job.url).toContain(encodeURIComponent(record.referenznummer));}finally{globalThis.fetch=original;}});
  it.each([{}, {ergebnisliste:[]}])("treats missing or empty v6 result sets as zero jobs",async payload=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify(payload));try{await expect(new BundesagenturAdapter(preferences,25).discover()).resolves.toEqual([]);}finally{globalThis.fetch=original;}});
  it("preserves provider errors for HTTP failures",async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response("forbidden",{status:403});try{await expect(new BundesagenturAdapter(preferences,25).discover()).rejects.toThrow("BA returned 403");}finally{globalThis.fetch=original;}});
});
