import crypto from "node:crypto";
import type { NormalizedJob } from "../types";

export const normalizeIdentity=(v="")=>v.toLowerCase().replace(/https?:\/\/(www\.)?/,'').replace(/[^a-z0-9]+/g,' ').trim();
export const hashJobDescription=(v:string)=>crypto.createHash("sha256").update(normalizeIdentity(v)).digest("hex");
const official=(s:string)=>/greenhouse|lever|ashby|personio|workday|smartrecruiters|successfactors|career|careers/i.test(s);
export function selectCanonical(a:{url:string;sourceName:string},b:{url:string;sourceName:string}) { return official(b.sourceName+" "+b.url) && !official(a.sourceName+" "+a.url) ? b : a; }
export const normalizedEqual=(a:string|undefined|null,b:string|undefined|null)=>normalizeIdentity(a||"")===normalizeIdentity(b||"");
export const canRepairSourceOwnership=(owner:any,target:any,incoming:NormalizedJob)=>Boolean(owner&&target&&owner.id!==target.id&&owner.canonical_url!==incoming.url&&target.canonical_url===incoming.url&&target.external_id===incoming.externalId&&normalizedEqual(target.company,incoming.company)&&normalizedEqual(target.title,incoming.title)&&normalizedEqual(target.location,incoming.location));
