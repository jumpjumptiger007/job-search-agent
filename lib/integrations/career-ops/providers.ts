import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsPaths } from "./paths";
import { getProjectRoot } from "../../project-root";

type CareerOpsModuleImporter = (specifier:string)=>Promise<Record<string,unknown>>;
// The workspace CJS shim keeps this runtime import out of Next's static module transform.
function importCareerOpsModule(specifier:string, projectRoot:string) {
  const rootRequire = createRequire(path.join(projectRoot,"package.json"));
  const loadNativeModule = rootRequire(path.join(projectRoot,"lib/integrations/career-ops/native-import.cjs")) as CareerOpsModuleImporter;
  return loadNativeModule(specifier);
}

export type CareerOpsTransport = {
  fetchJson:(url:string, options?:object)=>Promise<unknown>;
  fetchText:(url:string, options?:object)=>Promise<string>;
  fetchResponse:(url:string, options?:object)=>Promise<Response>;
  sleep?:(ms:number)=>Promise<void>;
};
export type CareerOpsProviderJob = { title:string; url:string; company:string; location?:string; description?:string; postedAt?:number; [key:string]:unknown };
export type CareerOpsProvider = { id:string; fetch:(entry:unknown,ctx:CareerOpsTransport)=>Promise<CareerOpsProviderJob[]>; detect?:(entry:unknown)=>unknown; dedupKey?:(job:CareerOpsProviderJob)=>string|null };

const supportedProviderIds = new Set(["greenhouse","lever","personio","arbeitsagentur"]);

export async function loadCareerOpsProvider(id:string, projectRoot = getProjectRoot()):Promise<CareerOpsProvider> {
  if (!supportedProviderIds.has(id)) throw new Error(`Unsupported Career Ops provider: ${id}`);
  const {providers} = careerOpsPaths(projectRoot);
  const file = path.join(providers,`${id}.mjs`);
  if (!fs.statSync(file,{throwIfNoEntry:false})?.isFile()) throw new Error(`Career Ops provider is missing: ${id}`);
  const provider = (await importCareerOpsModule(pathToFileURL(file).href, projectRoot)).default as CareerOpsProvider;
  if (!provider || typeof provider.id !== "string" || !provider.id.trim() || typeof provider.fetch !== "function") throw new Error(`Invalid Career Ops provider contract: ${id}`);
  return provider;
}

export function injectableCareerOpsTransport(transport:CareerOpsTransport) {
  for (const name of ["fetchJson","fetchText","fetchResponse"] as const) if (typeof transport[name] !== "function") throw new Error(`Career Ops transport requires ${name}`);
  return transport;
}

export async function loadCareerOpsTransport(projectRoot = getProjectRoot()):Promise<CareerOpsTransport> {
  const {providers} = careerOpsPaths(projectRoot);
  const http = await importCareerOpsModule(pathToFileURL(path.join(providers,"_http.mjs")).href, projectRoot);
  return injectableCareerOpsTransport(http as CareerOpsTransport);
}
