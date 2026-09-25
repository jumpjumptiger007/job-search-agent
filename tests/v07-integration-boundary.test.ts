import fs from "node:fs";
import path from "node:path";
import { afterEach,describe,expect,it } from "vitest";
import { assertNoCareerOpsCanonicalState,forbiddenCareerOpsState } from "../lib/career-ops-boundary";

const root="/private/tmp/v07-career-ops-boundary";
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
describe("V0.7 Career Ops integration boundary",()=>{
 it("forbids each Career Ops-owned canonical state path",()=>{for(const relativePath of forbiddenCareerOpsState){fs.rmSync(root,{recursive:true,force:true});const target=path.join(root,relativePath);if(relativePath.endsWith("/" )||relativePath==="reports")fs.mkdirSync(target,{recursive:true});else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,"private");}expect(()=>assertNoCareerOpsCanonicalState(root)).toThrow(`Career Ops canonical state is forbidden: ${relativePath}`);}});
});
