import fs from "node:fs";
import path from "node:path";
import { getProjectRoot } from "../../project-root";

export const CAREER_OPS_VERSION = "1.34.0";
export const CAREER_OPS_TAG = "career-ops-v1.34.0";
export const CAREER_OPS_COMMIT = "de7f7fe8fe65852b9743bbdce94f0304101a749e";

export type CareerOpsPaths = { root:string; providers:string; modes:string };

export function careerOpsPaths(projectRoot = getProjectRoot()): CareerOpsPaths {
  const root = path.resolve(projectRoot,"vendor/career-ops");
  if (!fs.statSync(root,{throwIfNoEntry:false})?.isDirectory()) throw new Error(`Career Ops submodule is missing: ${root}`);
  const paths = {root,providers:path.join(root,"providers"),modes:path.join(root,"modes")};
  if (!fs.statSync(paths.providers,{throwIfNoEntry:false})?.isDirectory() || !fs.statSync(paths.modes,{throwIfNoEntry:false})?.isDirectory()) throw new Error("Career Ops submodule is incomplete: providers/ and modes/ are required");
  const version = fs.readFileSync(path.join(root,"VERSION"),"utf8").trim().split(/\s+/)[0];
  if (version !== CAREER_OPS_VERSION) throw new Error(`Unexpected Career Ops VERSION: expected ${CAREER_OPS_VERSION}, found ${version || "missing"}`);
  return paths;
}

export function careerOpsFile(paths:CareerOpsPaths, relative:string) {
  const resolved = path.resolve(paths.root,relative);
  if (resolved !== paths.root && !resolved.startsWith(`${paths.root}${path.sep}`)) throw new Error(`Career Ops path escapes submodule: ${relative}`);
  return resolved;
}
