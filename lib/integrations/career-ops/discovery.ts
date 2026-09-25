import type { DiscoveredJob, DiscoveryPreferences } from "../../types";
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

const personioHost = /^[a-z0-9][a-z0-9-]*\.jobs\.personio\.(?:de|com)$/i;
const personioConfigError = "Personio source must be an explicit public https://<tenant>.jobs.personio.<tld> URL";
export function validatePersonioSource(source:unknown) {
  const raw = typeof source === "string" ? source.trim() : "";
  try { const url = new URL(raw); if (url.protocol !== "https:" || url.username || url.password || !personioHost.test(url.hostname)) throw new Error(); return {tenant:url.hostname.split(".")[0].toLowerCase(),url:`https://${url.hostname}`}; }
  catch { throw new Error(personioConfigError); }
}
const personioId = (url:string,tenant:string) => { try { const parsed=new URL(url),id=parsed.pathname.match(/^\/job\/(\d+)$/)?.[1],host=parsed.hostname.toLowerCase(); return host===`${tenant}.jobs.personio.de`||host===`${tenant}.jobs.personio.com` ? id : undefined; } catch { return undefined; } };
const personioText = (value:string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":"\"","&#39;":"'"})[entity] || entity).replace(/\s+/g," ").trim();
/** Observes host-only fields for an already accepted Personio job; it never discovers rows. */
function personioFields(xml:string,id:string) {
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),starts=[...xml.matchAll(/<position\b[^>]*>/gi)].map(match=>match.index!);
  const position=starts.map((start,index)=>xml.slice(start,starts[index+1])).find(block=>new RegExp(`<id\\b[^>]*>\\s*${escaped}\\s*</id>`,"i").test(block))||"";
  const field=(tag:string)=>position.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`,"i"))?.[1];
  return {description:personioText(field("jobDescriptions")||""),workModel:personioText(field("employmentType")||"")};
}
/** Runs the pinned Personio provider, observing its XML response only for accepted-row compatibility fields. */
export async function discoverPersonio(source:unknown,company?:string,limit?:number,transport?:CareerOpsTransport):Promise<DiscoveredJob[]> {
  const config=validatePersonioSource(source),projectRoot=path.resolve(__dirname,"../../.."),provider=await loadCareerOpsProvider("personio",projectRoot),base=transport||await loadCareerOpsTransport(projectRoot); let xml="";
  const wrapped={...base,fetchText:async(url:string,options?:object)=>{const body=await base.fetchText(url,options);if(url===`${config.url}/xml`)xml=body;return body;}};
  const rows=await provider.fetch({name:company||config.tenant,careers_url:config.url},injectableCareerOpsTransport(wrapped));
  return rows.slice(0,limit).map(sourceJob=>{const id=personioId(sourceJob.url,config.tenant),fields=id&&xml?personioFields(xml,id):undefined;const {job}=adaptCareerOpsJob({...sourceJob,description:fields?.description||sourceJob.description},provider,"Personio");return {...job,ats:"Personio",...(id?{externalId:`personio:${config.tenant}:${id}`} : {}),...(fields?.workModel?{workModel:fields.workModel}:{}),discoveredVia:"configured ATS"};});
}

type ArbeitsagenturRaw = { referenznummer?:unknown; datumErsteVeroeffentlichung?:unknown; };
const arbeitsagenturApi = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
const arbeitsagenturReference = (url:string) => {
  try {
    const parsed=new URL(url),parts=parsed.pathname.split("/").filter(Boolean);
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "www.arbeitsagentur.de" || parts.length !== 3 || parts[0] !== "jobsuche" || parts[1] !== "jobdetail") return undefined;
    const reference=decodeURIComponent(parts[2]); return reference || undefined;
  } catch { return undefined; }
};
const arbeitsagenturPostedAt = (value:unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed=typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) && !Number.isNaN(new Date(parsed).valueOf()) ? parsed : undefined;
};

/** Runs the pinned Arbeitsagentur provider while keeping project preferences and identity local. */
export async function discoverArbeitsagentur(preferences:DiscoveryPreferences,limit:number,transport?:CareerOpsTransport):Promise<DiscoveredJob[]> {
  const keywords=[...new Set((preferences.roleFamilies||[]).map(role=>role.trim()).filter(Boolean))];
  if (!keywords.length) return [];
  const projectRoot=path.resolve(__dirname,"../../.."),provider=await loadCareerOpsProvider("arbeitsagentur",projectRoot),base=transport||await loadCareerOpsTransport(projectRoot),postedAtByReference=new Map<string,number|null>();
  const wrapped={...base,fetchJson:async(url:string,options?:object)=>{
    const body=await base.fetchJson(url,options);
    if (url.startsWith(`${arbeitsagenturApi}?`) && Array.isArray((body as any)?.ergebnisliste)) for (const raw of (body as any).ergebnisliste as ArbeitsagenturRaw[]) {
      const reference=typeof raw?.referenznummer === "string" ? raw.referenznummer : "";
      const postedAt=arbeitsagenturPostedAt(raw?.datumErsteVeroeffentlichung),existing=postedAtByReference.get(reference);
      if (reference && postedAt !== undefined && existing !== null) postedAtByReference.set(reference,existing === undefined || existing === postedAt ? postedAt : null);
    }
    return body;
  }};
  const location=(preferences.location||"").trim(),nationwide=/^germany$/i.test(location),specific=Boolean(location&&!nationwide),days=Number.isInteger(preferences.postingAgeDays)&&Number(preferences.postingAgeDays)>0 ? Math.min(1000,Number(preferences.postingAgeDays)) : 1000;
  const radius=typeof preferences.radiusKm === "number"&&Number.isFinite(preferences.radiusKm)&&preferences.radiusKm>=0 ? preferences.radiusKm : 0;
  const entry={name:"Arbeitsagentur",arbeitsagentur:{keywords,...(specific?{wo:location,umkreis:radius}:{}),days,size:Math.min(100,Math.max(25,limit))}};
  const rows=await provider.fetch(entry,injectableCareerOpsTransport(wrapped));
  return rows.slice(0,limit).map(source=>{
    const reference=arbeitsagenturReference(source.url),postedAt=reference ? postedAtByReference.get(reference) : undefined;
    const {job}=adaptCareerOpsJob({...source,...(typeof postedAt === "number" ? {postedAt} : {})},provider,"Bundesagentur für Arbeit");
    return {...job,ats:"BA",...(reference ? {externalId:`ba:${reference}`} : {}),discoveredVia:"Bundesagentur für Arbeit"};
  });
}
