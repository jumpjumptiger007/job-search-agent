import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { assertNoCareerOpsCanonicalState } from "../../career-ops-boundary";
import { CAREER_OPS_COMMIT,careerOpsFile,careerOpsPaths } from "./paths";

const requiredFiles = ["providers/greenhouse.mjs","providers/lever.mjs","providers/personio.mjs","providers/arbeitsagentur.mjs","providers/_types.js","providers/ADDING_A_PROVIDER.md","providers/README.md","modes/_shared.md","modes/oferta.md"];

export function careerOpsDoctor(projectRoot = process.cwd()) {
  const paths = careerOpsPaths(projectRoot);
  for (const file of requiredFiles) if (!fs.statSync(careerOpsFile(paths,file),{throwIfNoEntry:false})?.isFile()) throw new Error(`Career Ops required file is missing: ${file}`);
  const commit = execFileSync("git",["rev-parse","HEAD"],{cwd:paths.root,encoding:"utf8"}).trim();
  if (commit !== CAREER_OPS_COMMIT) throw new Error(`Unexpected Career Ops commit: expected ${CAREER_OPS_COMMIT}, found ${commit}`);
  assertNoCareerOpsCanonicalState(projectRoot);
  return {version:"1.34.0",commit,requiredFiles};
}
