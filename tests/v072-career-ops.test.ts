import fs from "node:fs";
import { describe,expect,it } from "vitest";
import { assertNoCareerOpsCanonicalState,forbiddenCareerOpsState } from "../lib/career-ops-boundary";
import { CAREER_OPS_COMMIT,adaptCareerOpsJob,careerOpsDoctor,injectableCareerOpsTransport,loadCareerOpsMode,loadCareerOpsProvider,loadCareerOpsTransport } from "../lib/integrations/career-ops";

describe("V0.7.2 Career Ops upstream boundary",()=>{
 it("verifies the pinned upstream without creating Career Ops state",()=>{expect(careerOpsDoctor()).toMatchObject({commit:CAREER_OPS_COMMIT,version:"1.34.0"});expect(forbiddenCareerOpsState.every(file=>!fs.existsSync(file))).toBe(true);});
 it("reads only requested system modes and rejects traversal",()=>{expect(loadCareerOpsMode("_shared.md").length).toBeGreaterThan(0);expect(loadCareerOpsMode("oferta.md").length).toBeGreaterThan(0);expect(()=>loadCareerOpsMode("../data/pipeline.md")).toThrow("Invalid Career Ops system mode path");});
 it("loads only explicit supported provider modules",async()=>{for(const id of ["greenhouse","lever","personio","arbeitsagentur"]){const provider=await loadCareerOpsProvider(id);expect(provider.id).toBe(id);expect(provider.fetch).toBeTypeOf("function");}await expect(loadCareerOpsProvider("../scan")).rejects.toThrow("Unsupported Career Ops provider");});
 it("adapts provider output without ingestion or global external IDs",()=>{const provider={id:"greenhouse",fetch:async()=>[],dedupKey:()=>"tenant:42"};const result=adaptCareerOpsJob({company:"Acme",title:"Engineer",location:"Berlin",url:"https://example.test/42",postedAt:0},provider,"Acme Careers");expect(result).toEqual({job:{company:"Acme",title:"Engineer",location:"Berlin",url:"https://example.test/42",sourceName:"Acme Careers",description:"",contentStatus:"INSUFFICIENT",postedAt:"1970-01-01T00:00:00.000Z"},provider:{id:"greenhouse",dedupKey:"tenant:42"}});expect(result.job.externalId).toBeUndefined();});
 it("keeps transport dependency-injectable and state boundary clean",async()=>{const transport=injectableCareerOpsTransport({fetchJson:async()=>({}),fetchText:async()=>"",fetchResponse:async()=>new Response()});expect(transport.fetchText).toBeTypeOf("function");expect((await loadCareerOpsTransport()).fetchJson).toBeTypeOf("function");assertNoCareerOpsCanonicalState();});
});
