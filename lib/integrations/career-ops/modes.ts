import fs from "node:fs";
import path from "node:path";
import { careerOpsPaths } from "./paths";
import { getProjectRoot } from "../../project-root";

export function loadCareerOpsMode(relativePath:string, projectRoot = getProjectRoot()) {
  if (!relativePath.endsWith(".md") || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) throw new Error(`Invalid Career Ops system mode path: ${relativePath}`);
  const {modes} = careerOpsPaths(projectRoot);
  const file = path.resolve(modes,relativePath);
  if (!file.startsWith(`${modes}${path.sep}`)) throw new Error(`Career Ops mode path escapes system tree: ${relativePath}`);
  if (!fs.statSync(file,{throwIfNoEntry:false})?.isFile()) throw new Error(`Career Ops system mode is missing: ${relativePath}`);
  return fs.readFileSync(file,"utf8");
}
