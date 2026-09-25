import type { DiscoveredJob } from "../../types";
import path from "node:path";
import { adaptCareerOpsJob } from "./normalize";
import { injectableCareerOpsTransport,loadCareerOpsProvider,loadCareerOpsTransport,type CareerOpsTransport } from "./providers";

const greenhouseJobId = (url:string, board:string) => {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[0] === board && parts[1] === "jobs" && /^\d+$/.test(parts[2] || "") ? parts[2] : undefined;
  } catch { return undefined; }
};

/** Runs the pinned Greenhouse provider while retaining this application's identity rules. */
export async function discoverGreenhouse(board:string, limit?:number, transport?:CareerOpsTransport):Promise<DiscoveredJob[]> {
  const projectRoot = path.resolve(__dirname,"../../..");
  const provider = await loadCareerOpsProvider("greenhouse",projectRoot);
  const rows = await provider.fetch({name:board,api:`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`},transport || await loadCareerOpsTransport(projectRoot));
  return rows.slice(0,limit).map(source => {
    const {job} = adaptCareerOpsJob(source,provider,"Greenhouse");
    const id = greenhouseJobId(job.url,board);
    return {...job,ats:"Greenhouse",...(id ? {externalId:`greenhouse:${board}:${id}`} : {}),discoveredVia:"configured ATS"};
  });
}

type LeverRawPosting = { hostedUrl?:unknown; id?:unknown; additionalPlain?:unknown; workplaceType?:unknown };

/** Runs the pinned Lever provider once, retaining only host fields it deliberately omits. */
export async function discoverLever(company:string, limit?:number, transport?:CareerOpsTransport):Promise<DiscoveredJob[]> {
  const projectRoot = path.resolve(__dirname,"../../..");
  const provider = await loadCareerOpsProvider("lever",projectRoot);
  const base = transport || await loadCareerOpsTransport(projectRoot),rawByUrl=new Map<string,LeverRawPosting|null>();
  const wrapped = {...base,fetchJson:async(url:string,options?:object)=>{
    const body = await base.fetchJson(url,options);
    if (Array.isArray(body)) for (const row of body as LeverRawPosting[]) if (typeof row?.hostedUrl === "string") rawByUrl.set(row.hostedUrl,rawByUrl.has(row.hostedUrl) ? null : row);
    return body;
  }};
  const rows = await provider.fetch({name:company,api:`https://api.lever.co/v0/postings/${encodeURIComponent(company)}`},injectableCareerOpsTransport(wrapped));
  return rows.slice(0,limit).map(source => {
    const raw = rawByUrl.get(source.url),description=[source.description,typeof raw?.additionalPlain === "string" ? raw.additionalPlain : ""].filter(Boolean).join("\n");
    const {job} = adaptCareerOpsJob({...source,description},provider,"Lever");
    const id = typeof raw?.id === "string" && raw.id ? raw.id : undefined;
    return {...job,ats:"Lever",...(id ? {externalId:`lever:${company}:${id}`} : {}),...(typeof raw?.workplaceType === "string" ? {workModel:raw.workplaceType} : {}),discoveredVia:"configured ATS"};
  });
}
