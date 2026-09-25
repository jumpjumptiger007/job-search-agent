import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsPaths } from "./paths";

export type CareerOpsTransport = {
  fetchJson:(url:string, options?:object)=>Promise<unknown>;
  fetchText:(url:string, options?:object)=>Promise<string>;
  fetchResponse:(url:string, options?:object)=>Promise<Response>;
  sleep?:(ms:number)=>Promise<void>;
};
export type CareerOpsProviderJob = { title:string; url:string; company:string; location?:string; description?:string; postedAt?:number; [key:string]:unknown };
export type CareerOpsProvider = { id:string; fetch:(entry:unknown,ctx:CareerOpsTransport)=>Promise<CareerOpsProviderJob[]>; detect?:(entry:unknown)=>unknown; dedupKey?:(job:CareerOpsProviderJob)=>string|null };

const supportedProviderIds = new Set(["greenhouse","lever","personio","arbeitsagentur"]);

export async function loadCareerOpsProvider(id:string, projectRoot = process.cwd()):Promise<CareerOpsProvider> {
  if (!supportedProviderIds.has(id)) throw new Error(`Unsupported Career Ops provider: ${id}`);
  const {providers} = careerOpsPaths(projectRoot);
  const file = path.join(providers,`${id}.mjs`);
  if (!fs.statSync(file,{throwIfNoEntry:false})?.isFile()) throw new Error(`Career Ops provider is missing: ${id}`);
  const provider = (await import(pathToFileURL(file).href)).default as CareerOpsProvider;
  if (!provider || typeof provider.id !== "string" || !provider.id.trim() || typeof provider.fetch !== "function") throw new Error(`Invalid Career Ops provider contract: ${id}`);
  return provider;
}

export function injectableCareerOpsTransport(transport:CareerOpsTransport) {
  for (const name of ["fetchJson","fetchText","fetchResponse"] as const) if (typeof transport[name] !== "function") throw new Error(`Career Ops transport requires ${name}`);
  return transport;
}

export async function loadCareerOpsTransport(projectRoot = process.cwd()):Promise<CareerOpsTransport> {
  const {providers} = careerOpsPaths(projectRoot);
  const http = await import(pathToFileURL(path.join(providers,"_http.mjs")).href);
  return injectableCareerOpsTransport(http as CareerOpsTransport);
}
