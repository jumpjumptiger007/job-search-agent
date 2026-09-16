import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb,db } from "../lib/db";
import { ingest,setApplicationStatus,setReviewStatus } from "../lib/jobs";
import { matchesPreferences } from "../lib/discovery";
const file=path.join("/private/tmp","v04-release.sqlite");
beforeEach(()=>{closeDb();process.env.JOB_AGENT_DB_PATH=file;fs.rmSync(file,{force:true});});afterEach(()=>{closeDb();fs.rmSync(file,{force:true});});
const add=()=>ingest({company:"Acme",title:"Engineer",url:"https://careers.example/a",sourceName:"Careers",description:"German and English required"}).job;
const candidate=(description:string)=>({company:"Acme",title:"Engineer",url:"https://example.com/a",sourceName:"Test",description});
describe("V0.4 workflow",()=>{
 it("persists review decisions and audits them",()=>{const j=add();setReviewStatus(j.job_id,"INTERESTED");setReviewStatus(j.job_id,"SKIPPED");expect(db().prepare("SELECT review_status,skipped FROM jobs WHERE id=?").get(j.id)).toEqual({review_status:"SKIPPED",skipped:1});expect(db().prepare("SELECT action FROM audit_events WHERE job_id=? ORDER BY id DESC LIMIT 2").all(j.id)).toEqual([{action:"REVIEW_SKIPPED"},{action:"REVIEW_INTERESTED"}]);});
 it("keeps pending jobs outside the material-ready workflow",()=>{const j=add();expect(db().prepare("SELECT review_status,material_status FROM jobs WHERE id=?").get(j.id)).toEqual({review_status:"PENDING",material_status:"NOT_GENERATED"});});
 it("requires ready materials before manual Ready to apply",()=>{const j=add();expect(()=>setApplicationStatus(j.job_id,"READY_TO_APPLY")).toThrow();setReviewStatus(j.job_id,"INTERESTED");db().prepare("UPDATE jobs SET material_status='READY' WHERE id=?").run(j.id);expect(setApplicationStatus(j.job_id,"READY_TO_APPLY").application_status).toBe("READY_TO_APPLY");});
 it("normalizes legacy states",()=>{const j=add();db().prepare("UPDATE jobs SET review_status='APPROVED' WHERE id=?").run(j.id);closeDb();expect(db().prepare("SELECT review_status FROM jobs WHERE job_id=?").get(j.job_id)).toEqual({review_status:"INTERESTED"});});
});
describe("V0.4 language preferences",()=>{
 it("handles German English and both",()=>{expect(matchesPreferences(candidate("German required"),{workingLanguage:"German"})).toBe(true);expect(matchesPreferences(candidate("German required"),{workingLanguage:"English"})).toBe(false);expect(matchesPreferences(candidate("German and English required"),{workingLanguage:"German & English"})).toBe(true);expect(matchesPreferences(candidate("German required"),{workingLanguage:"German & English"})).toBe(false);});
 it("keeps Preferred non-blocking and Required blocking",()=>{expect(matchesPreferences(candidate("English required"),{workingLanguage:"English",otherLanguages:[{language:"Spanish",requirement:"Preferred"}]})).toBe(true);expect(matchesPreferences(candidate("English required"),{workingLanguage:"English",otherLanguages:[{language:"Spanish",requirement:"Required"}]})).toBe(false);});
});
