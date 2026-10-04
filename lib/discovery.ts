import fs from "node:fs";
import { URL } from "node:url";
import YAML from "yaml";
import { ingest } from "./jobs";
import { db } from "./db";
import type { DiscoveredJob, DiscoveryPreferences } from "./types";
import { discoverArbeitsagentur,discoverGreenhouse,discoverLever,discoverPersonio,validatePersonioSource } from "./integrations/career-ops";
import type { CareerOpsTransport } from "./integrations/career-ops";
import { LinkedInAdapter, type LinkedInRunner } from "./integrations/linkedin";
import { ArbeitnowAdapter, type ArbeitnowFetcher } from "./integrations/arbeitnow";
import { WorkableAdapter, type WorkableFetcher } from "./integrations/workable";
import { getProjectRoot, resolveProjectPath } from "./project-root";

export interface DiscoveryAdapter { name:string; discover():Promise<DiscoveredJob[]>; }
const transientTransportCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ECONNRESET",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"
]);

export function isTransientDiscoveryError(error: unknown): boolean {
  const visited = new Set<unknown>();
  while (error && typeof error === "object" && !visited.has(error)) {
    visited.add(error);
    const detail = error as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
    const message = String(detail.message).trim();
    // Application, configuration and parsing errors must not become retryable via their wording.
    if (detail.name === "SyntaxError" || /\bHTTP\s+\d{3}\b|\b(?:configuration|validation|schema)\b|\b(?:malformed|invalid)\s+JSON\b/i.test(message)) return false;
    if (transientTransportCodes.has(String(detail.code))) return true;
    if (detail.name === "TimeoutError" || detail.name === "ConnectTimeoutError") return true;
    if (/^(?:fetch failed|connect timeout(?: error)?|network request timed out)$/i.test(message)) return true;
    // These adapters flatten transport causes into their provider/CLI messages.
    if (/\b(?:ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET)\b/.test(message)) return true;
    if (/^arbeitsagentur: all [1-9]\d* keyword request\(s\) failed — ".*": fetch failed$/s.test(message)) return true;
    error = detail.cause;
  }
  return false;
}

export async function discoverWithRetry(adapter: DiscoveryAdapter): Promise<DiscoveredJob[]> {
  try { return await adapter.discover(); }
  catch (error) {
    if (!isTransientDiscoveryError(error)) throw error;
    return adapter.discover();
  }
}

type WebConfig={enabled?:boolean;maxQueries?:number;maxRawCandidates?:number;maxProcessedCandidates?:number;endpoint?:string};
const jobText=(html:string="")=>html.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const positive=(value:unknown,fallback:number)=>Number.isInteger(value)&&Number(value)>0?Number(value):fallback;
const hostname=(value:string)=>{try{return new URL(value).hostname.replace(/^www\./,"");}catch{return "";}};
const personioHost=/^[a-z0-9-]+\.jobs\.personio\.(?:de|com)$/i;
const isPersonioUrl=(value:string)=>{try{return personioHost.test(new URL(value).hostname);}catch{return false;}};
const atsFor=(url:string)=>/greenhouse\.io/.test(url)?"Greenhouse":/lever\.co/.test(url)?"Lever":isPersonioUrl(url)?"Personio":undefined;
const tenantFor=(url:string,ats?:string)=>{try{const u=new URL(url),parts=u.pathname.split("/").filter(Boolean);if(ats==="Greenhouse"||ats==="Lever")return parts[0];if(ats==="Personio")return u.hostname.match(/^([^.]+)\.jobs\.personio\.[a-z]+$/i)?.[1];return undefined;}catch{return undefined;}};
const sourceIdentity=(url:string,ats?:string)=>`${ats||"careers"}:${tenantFor(url,ats)||hostname(url)}`.toLowerCase();
const languageAliases={german:["german","deutsch"],english:["english","englisch"],spanish:["spanish","spanisch"]} as const;
const genericRoleTerms=new Set(["management","manage","manager","operations","operation"]);
const hasLanguage=(text:string,language:string)=>((languageAliases as Record<string,readonly string[]>)[language.toLowerCase()]||[language.toLowerCase()]).some(alias=>new RegExp(`\\b${alias}\\b`).test(text));
const mentionedLanguages=(text:string)=>Object.keys(languageAliases).filter(language=>hasLanguage(text,language));
const roleWords=(value:string)=>value.toLowerCase().match(/[a-z0-9+#]+/g)||[];
const roleStem=(word:string)=>word.replace(/(?:ments?|ers?|ing|s)$/,"" ).replace(/ag$/,"age");
const hasRoleWords=(text:string,words:string[])=>{const actual=new Set(roleWords(text).map(roleStem));return words.every(word=>actual.has(roleStem(word)));};
const explicitJuniorOrStudentTitle=/\b(?:intern(?:ship)?|praktik(?:um|ant(?:in)?|antin)|working[ -]?student|werkstudent(?:in)?|junior|entry[ -]?level|graduate(?:\s+role)?)\b/i;
const substantiveDescription=(title:string,description:string)=>description.trim().length>=80&&normText(title)!==normText(description);
const normText=(value:string)=>value.toLowerCase().replace(/\s+/g," ").trim();

/** Keeps broad role-family words from admitting unrelated jobs on JD text alone. */
export function matchesRoleFamilies(job:DiscoveredJob, families:string[]){
  if(!families.length)return true;
  const title=job.title||"", description=job.description||"";
  return families.some(family=>{
    const words=roleWords(family), specific=words.filter(word=>!genericRoleTerms.has(roleStem(word)));
    if(!specific.length)return words.length===1&&roleStem(words[0])==="operation"&&hasRoleWords(title,words)&&/\b(?:manager|lead|director|head)\b/i.test(title);
    if(hasRoleWords(title,words))return true;
    if(!specific.some(word=>hasRoleWords(title,[word])))return false;
    if(hasRoleWords(description,words))return true;
    return /\b(?:owner|lead|director|manager|coordinator)\b/i.test(title);
  });
}

const compatibleRegion=(text:string)=>/germany|deutschland|european union|\beu\b|europe|worldwide|work from anywhere|anywhere in the world/i.test(text);
const incompatibleStructuredRegion=/\b(?:apac|asia(?:[- ]pacific)?|americas|north america|middle east|africa)\b/i;
const countryName=(code:string)=>{try{return new Intl.DisplayNames(["en"],{type:"region"}).of(code);}catch{return undefined;}};
const countryNames=new Set(Array.from({length:26},(_,a)=>Array.from({length:26},(_,b)=>String.fromCharCode(65+a,65+b))).flatMap(codes=>codes.map(countryName)).filter((name):name is string=>Boolean(name&&name!=="Unknown Region"&&name.length>2)).map(name=>name.toLowerCase()));
const foreignCountryAbbreviations=new Set(["us","uk","gb"]);
const foreignResidency=/(?:must|need to|are required to|applicants must)\s+(?:be\s+)?(?:a\s+)?(?:residents?|reside|live|living|residing|based|located)\s+(?:in|within)\s+([^.;,\n]+)/i;
const requiredForeignResidency=/(?:residency|residence|resident status)\s+(?:in|within)\s+([^.;,\n]+?)\s+(?:is\s+)?required/i;
const explicitForeignRoleLocation=/(?:position|role|job|work location)\s+(?:is\s+)?(?:based|located)\s+in\s+([^.;,\n]+)/i;
const foreignAuthorization=/(?:must|need to|are required to|applicants must)\s+(?:be\s+)?(?:(?:(?:legally|currently)\s+)?authorized|eligible|have (?:the )?right)\s+(?:to )?work\s+(?:in\s+)?([^.;,\n]+)/i;
const existingForeignAuthorization=/(?:must|need to|are required to|applicants must)\s+(?:have|hold|possess)\s+(?:(?:existing|valid|current|unrestricted)\s+)?(?:work authorization|work authorisation|work permit|right to work)\s+(?:in|for)\s+([^.;,\n]+)/i;
const requiredForeignAuthorization=/(?:(?:existing|valid|current)\s+)?(?:work authorization|work authorisation|work permit|right to work)\s+(?:in|for)\s+([^.;,\n]+?)\s+(?:is\s+)?required/i;
const clearlyForeignRequirement=(text:string,pattern:RegExp)=>{const match=text.match(pattern),target=match?.[1]?.trim()||"";return Boolean(target&&!/^(?:your|home|any|another|the country)\b/i.test(target)&&!compatibleRegion(target)&&target.length<45);};
const clearlyForeignStructuredLocation=(value:string)=>Boolean(value&&(!compatibleRegion(value))&&(foreignCountryAbbreviations.has(value.toLowerCase())||countryNames.has(value.toLowerCase())||incompatibleStructuredRegion.test(value)||/,/.test(value)));
const mentionsForeignCountry=(value:string)=>Array.from(countryNames).some(country=>value.toLowerCase().includes(country));

/** Rejects only explicit location, residency, or work-authorisation contradictions for Germany-based searches. */
export function isGermanyEligible(job:DiscoveredJob){
  const location=job.location||"", all=`${job.title||""}\n${job.description||""}`;
  if(/\b(?:europe|eu|european union|remote).{0,50}\b(?:excluding|except(?: for)?)\s+(?:germany|deutschland)\b|\b(?:germany|deutschland)\s+(?:is\s+)?excluded\b/i.test(`${location}\n${all}`))return false;
  if(clearlyForeignRequirement(all,foreignResidency)||clearlyForeignRequirement(all,requiredForeignResidency)||clearlyForeignRequirement(all,explicitForeignRoleLocation)||clearlyForeignRequirement(all,foreignAuthorization)||clearlyForeignRequirement(all,existingForeignAuthorization)||clearlyForeignRequirement(all,requiredForeignAuthorization))return false;
  const normalizedLocation=location.trim();
  if(normalizedLocation&&/\b[a-z][a-z -]*-only\b/i.test(normalizedLocation)&&!compatibleRegion(normalizedLocation)&&!/^\s*(?:remote|hybrid)-only\b/i.test(normalizedLocation))return false;
  if(normalizedLocation&&!/[\/]|\bor\b/i.test(normalizedLocation)&&!compatibleRegion(normalizedLocation)&&(foreignCountryAbbreviations.has(normalizedLocation.toLowerCase())||mentionsForeignCountry(normalizedLocation)||normalizedLocation.split(/[,;•]/).some(part=>foreignCountryAbbreviations.has(part.trim().toLowerCase())||mentionsForeignCountry(part))))return false;
  if(normalizedLocation&&incompatibleStructuredRegion.test(normalizedLocation)&&!compatibleRegion(normalizedLocation))return false;
  const locationParts=normalizedLocation.split(/\s*(?:\/|\bor\b)\s*/i).filter(Boolean);
  if(locationParts.length>1&&locationParts.every(clearlyForeignStructuredLocation))return false;
  return true;
}

export const matchesPreferences=(job:DiscoveredJob,p:DiscoveryPreferences)=>{
  const all=`${job.title} ${job.description}`.toLowerCase();
  if(p.roleFamilies?.length&&!matchesRoleFamilies(job,p.roleFamilies))return false;
  if(p.seniority?.some(level=>/^(?:mid|senior)$/i.test(level))&&explicitJuniorOrStudentTitle.test(job.title))return false;
  if(p.location?.toLowerCase()==="germany"&&!isGermanyEligible(job))return false;
  if(p.remotePreference&&p.remotePreference!=="any"&&!`${job.workModel||""} ${job.title} ${job.description}`.toLowerCase().includes(p.remotePreference.toLowerCase()))return false;
  const mentioned=mentionedLanguages(all),legacy:string[]=((p as any).language||[]).map((x:string)=>x.toLowerCase()==="deutsch"?"german":x.toLowerCase()==="englisch"?"english":x.toLowerCase()),strict=p.workingLanguage==="German & English",primary=strict?["german","english"]:p.workingLanguage?[p.workingLanguage.toLowerCase()]:legacy;
  if(mentioned.length&&primary.length&&(strict?!primary.every(language=>mentioned.includes(language)):!mentioned.some(language=>primary.includes(language))))return false;
  if((p.otherLanguages||[]).some(x=>x.requirement==="Required"&&!hasLanguage(all,x.language)))return false;
  return !(p.postingAgeDays&&job.postedAt&&Date.parse(job.postedAt)<Date.now()-p.postingAgeDays*86400000);
};

export class GreenhouseAdapter implements DiscoveryAdapter{name="Greenhouse";constructor(private board:string,private limit?:number,private projectRoot?:string){}async discover(){return discoverGreenhouse(this.board,this.limit,undefined,this.projectRoot);}}
export class LeverAdapter implements DiscoveryAdapter{name="Lever";constructor(private company:string,private limit?:number,private transport?:CareerOpsTransport,private projectRoot?:string){}async discover(){return discoverLever(this.company,this.limit,this.transport,this.projectRoot);}}
export class PersonioAdapter implements DiscoveryAdapter {name="Personio";constructor(private source:unknown,private limit?:number,_language="en",private company?:string,private transport?:CareerOpsTransport,private projectRoot?:string){validatePersonioSource(source);}async discover(){return discoverPersonio(this.source,this.company,this.limit,this.transport,this.projectRoot);}}
export class BundesagenturAdapter implements DiscoveryAdapter {
  name="Bundesagentur für Arbeit";
  constructor(private p:DiscoveryPreferences,private limit:number,private transport?:CareerOpsTransport,private projectRoot?:string){}
  async discover(){return discoverArbeitsagentur(this.p,this.limit,this.transport,this.projectRoot);}
}
export class WebSearchAdapter implements DiscoveryAdapter{name="Web search";constructor(private p:DiscoveryPreferences,private c:WebConfig){}async discover(){const out:DiscoveredJob[]=[];for(const role of(this.p.roleFamilies||[]).slice(0,positive(this.c.maxQueries,3))){const u=new URL(this.c.endpoint||"https://www.bing.com/search");u.searchParams.set("q",`${role} ${this.p.location||"Deutschland"} (site:careers.* OR site:jobs.* OR site:greenhouse.io OR site:lever.co)`);const init={headers:{"User-Agent":"job-search-agent/0.7.0 (local personal use)"}};const res=await fetch(u,init);if(!res.ok)throw new Error(`Web search returned ${res.status}`);const html=await res.text();for(const m of html.matchAll(/<li[^>]+class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){if(out.length>=positive(this.c.maxRawCandidates,30))break;const url=jobText(m[1]),title=jobText(m[2]);if(/^https?:\/\//.test(url))out.push({company:hostname(url)||"Unknown employer",title:title||"Job listing",url,sourceName:"Web search",ats:atsFor(url),description:title,discoveredVia:"web search"});}}return out.slice(0,positive(this.c.maxProcessedCandidates,15));}}
export async function resolveOfficial(job:DiscoveredJob){const direct=/\/careers?\//i.test(new URL(job.url).pathname);if(job.discoveredVia!=="web search"&&!direct)return job;try{const res=await fetch(job.url,{headers:{"User-Agent":"job-search-agent/0.7.0 (local personal use)"}});if(!res.ok)return direct?{...job,sourceName:"Official careers page"}:job;const html=await res.text(),description=jobText(html).slice(0,20000),enriched=description.length>job.description.length?description:job.description,found=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).find(x=>/greenhouse\.io|lever\.co|https?:\/\/[a-z0-9-]+\.jobs\.personio\.[a-z]{2,}(?:[/:?#]|$)|\/careers?\//i.test(x));if(!found||direct)return{...job,sourceName:"Official careers page",description:enriched};const url=new URL(found,job.url).href,ats=atsFor(url),tenant=tenantFor(url,ats),id=ats==="Personio"?new URL(url).pathname.match(/\/job\/([^/?#]+)/)?.[1]:undefined;return{...job,url,sourceName:ats||"Official careers page",ats,externalId:ats&&tenant?`${ats.toLowerCase()}:${tenant}:${id||url}`:job.externalId,description:enriched};}catch{return direct?{...job,sourceName:"Official careers page"}:job;}}
export function loadDiscoveryPreferences(file=resolveProjectPath("config/preferences.yaml")):DiscoveryPreferences{const path=resolveProjectPath(file),source=fs.existsSync(path)?path:resolveProjectPath("config/preferences.example.yaml"),c=YAML.parse(fs.readFileSync(source,"utf8"))||{},p=c.discovery||c;return{roleFamilies:p.roleFamilies||c.candidate?.roleFamilies||[],location:p.location||c.candidate?.location,radiusKm:p.radiusKm,remotePreference:p.remotePreference||c.candidate?.remotePreference,seniority:p.seniority,workingLanguage:p.workingLanguage,otherLanguages:p.otherLanguages,postingAgeDays:p.postingAgeDays,limits:p.limits};}
export function recordSource(job:DiscoveredJob){const ats=job.ats||atsFor(job.url);db().prepare("INSERT INTO source_registry(identity,company,domain,careers_url,ats,tenant,status,last_verified_at,discovered_via) VALUES(?,?,?,?,?, ?,'ACTIVE',CURRENT_TIMESTAMP,?) ON CONFLICT(identity) DO UPDATE SET company=excluded.company,domain=excluded.domain,careers_url=coalesce(excluded.careers_url,source_registry.careers_url),ats=coalesce(excluded.ats,source_registry.ats),tenant=coalesce(excluded.tenant,source_registry.tenant),status='ACTIVE',last_verified_at=CURRENT_TIMESTAMP,discovered_via=excluded.discovered_via").run(sourceIdentity(job.url,ats),job.company,hostname(job.url),ats?job.url:null,ats||null,tenantFor(job.url,ats)||null,job.discoveredVia||job.sourceName);}
export async function runDiscovery(configPath="config/search.yaml", options:{linkedinRunner?:LinkedInRunner;arbeitnowFetcher?:ArbeitnowFetcher;workableFetcher?:WorkableFetcher;careerOpsProjectRoot?:string}={}){
  const configFile=resolveProjectPath(configPath),careerOpsProjectRoot=options.careerOpsProjectRoot||getProjectRoot(),d=db(),run=d.prepare("INSERT INTO discovery_runs(sources_attempted) VALUES(?)").run(""),p=loadDiscoveryPreferences(),c=fs.existsSync(configFile)?YAML.parse(fs.readFileSync(configFile,"utf8"))||{}:{},adapters:DiscoveryAdapter[]=[],configurationErrors:string[]=[];
  for(const x of Array.isArray(c.providers)?c.providers:[]){
    if(!x||typeof x!=="object")continue;
    if(!x.enabled)continue;
    if(x.type==="greenhouse")adapters.push(new GreenhouseAdapter(x.board,x.limit,careerOpsProjectRoot));
    if(x.type==="lever")adapters.push(new LeverAdapter(x.company,x.limit,undefined,careerOpsProjectRoot));
    if(x.type==="personio")try{adapters.push(new PersonioAdapter(x.source??x.subdomain??x.tenant??x.url,x.limit,typeof x.language==="string"?x.language:"en",typeof x.company==="string"?x.company:undefined,undefined,careerOpsProjectRoot));}catch(error:any){configurationErrors.push(`Personio configuration: ${error.message}`);}
  }
  const max=positive(p.limits?.perRun,25);
  if(c.bundesagentur?.enabled)adapters.push(new BundesagenturAdapter(p,Math.min(max,positive(c.bundesagentur.limit,max)),undefined,careerOpsProjectRoot));
  if(c.arbeitnow?.enabled)adapters.push(new ArbeitnowAdapter(positive(c.arbeitnow.limit,50),options.arbeitnowFetcher));
  if(c.workable?.enabled)adapters.push(new WorkableAdapter(p,positive(c.workable.limit,50),options.workableFetcher));
  if(c.webSearch?.enabled)adapters.push(new WebSearchAdapter(p,c.webSearch));
  if(c.linkedin?.enabled)adapters.push(new LinkedInAdapter(p,Math.min(max,positive(c.linkedin.limit,5)),options.linkedinRunner));
  const stat={seen:0,newJobs:0,duplicates:0,failures:configurationErrors.length,blocked:0,upstreamCandidates:0,filteredCandidates:0,errors:configurationErrors};
  let remaining=max;
  const attempted:string[]=[];
  for(const a of adapters){
    if(!remaining)break;
    attempted.push(a.name);
    try{const candidates=await discoverWithRetry(a);stat.upstreamCandidates+=candidates.length;for(const candidate of candidates){if(!remaining)break;if(!matchesPreferences(candidate,p)){stat.filteredCandidates++;continue;}remaining--;const row=await resolveOfficial(candidate);if(!matchesPreferences(row,p)){stat.filteredCandidates++;continue;}stat.seen++;recordSource(row);const r=ingest(row);r.created?stat.newJobs++:stat.duplicates++;}}
    catch(error:any){stat.failures++;stat.errors.push(`${a.name}: ${error.message}`);}
  }
  d.prepare("UPDATE discovery_runs SET ended_at=CURRENT_TIMESTAMP,sources_attempted=?,jobs_seen=?,new_jobs=?,duplicates=?,failures=?,blocked_sources=?,upstream_candidates=?,filtered_candidates=?,accepted_candidates=?,errors=? WHERE id=?").run(attempted.join(", "),stat.seen,stat.newJobs,stat.duplicates,stat.failures,stat.blocked,stat.upstreamCandidates,stat.filteredCandidates,stat.seen,stat.errors.join("\n"),run.lastInsertRowid);
  return{...stat,configured:adapters.length};
}
