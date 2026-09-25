import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { PDFDocument } from "pdf-lib";
import { closeDb, db } from "../lib/db";
import { ingest, setReviewStatus } from "../lib/jobs";
import { persistJobAnalysis } from "../lib/agent-workflow";
import { buildRenderCVDocument, renderResume } from "../lib/integrations/rendercv";
import { generateMaterials, materialArtifacts } from "../lib/materials";
import { fakeRenderCV } from "./rendercv-runner";

let temporary: string;
const profile = { name: "Test Candidate", email: "test@example.com", location: "Berlin", summary: "Factual summary.", skills: ["TypeScript", "Unselected Secret Skill"], experience: [{ employer: "Acme", title: "Engineer", dates: "Spring 2020 to Autumn 2024", bullets: ["Built services.", "Unselected secret result."] }, { employer: "Hidden Co", title: "Hidden role", bullets: ["Hidden bullet."] }], education: ["Degree, Acme University, 2019"] };
const rawAnalysis = (jobId: string) => ({ schemaVersion: "v0.7", jobId, role: { archetype: "Engineer" }, requirements: [{ text: "TypeScript", evidence: "TypeScript" }], matches: [{ requirement: "TypeScript", candidateFactRefs: [{ kind: "skill", index: 0 }] }], gaps: [], germanyDachConsiderations: [], strengths: [{ kind: "skill", index: 0 }], keywords: [{ text: "TypeScript", priority: 1, evidence: "TypeScript" }], tailoringPlan: { skillIndexes: [0], experiences: [{ index: 0, bulletIndexes: [0] }], keywords: ["TypeScript"] }, evaluation: { score: 4 }, provenance: { candidateSource: "profile/profile.yaml", approvedFactRefs: [{ kind: "skill", index: 0 }, { kind: "experience", index: 0 }, { kind: "experienceBullet", index: 0, bulletIndex: 0 }] }, unsupportedClaims: [] });
const add = () => ingest({ company: "Acme", title: "Engineer", url: "https://careers.example/rendercv", sourceName: "Careers", description: "TypeScript engineering" }).job;

beforeEach(() => { closeDb(); temporary = fs.mkdtempSync(path.join(os.tmpdir(), "v076-rendercv-")); process.env.JOB_AGENT_DB_PATH = path.join(temporary, "jobs.sqlite"); process.env.JOB_AGENT_STORAGE_ROOT = temporary; fs.mkdirSync(path.join(temporary, "profile")); fs.writeFileSync(path.join(temporary, "profile", "profile.yaml"), YAML.stringify(profile)); });
afterEach(() => { closeDb(); delete process.env.JOB_AGENT_DB_PATH; delete process.env.JOB_AGENT_STORAGE_ROOT; fs.rmSync(temporary, { recursive: true, force: true }); });

describe("v0.7 Gate 6 RenderCV cutover", () => {
  it("builds selected factual content without inferring dates or education structure", () => {
    const job = add(); const analysis = persistJobAnalysis(job.job_id, rawAnalysis(job.job_id));
    const document = buildRenderCVDocument(profile, analysis);
    const serialized = YAML.stringify(document);
    expect(document.design.theme).toBe("engineeringresumes");
    expect(document.cv.sections.Skills).toEqual(["TypeScript"]);
    expect(document.cv.sections.Experience).toEqual([{ company: "Acme", position: "Engineer", date: "Spring 2020 to Autumn 2024", highlights: ["Built services."] }]);
    expect(document.cv.sections.Education).toEqual(["Degree, Acme University, 2019"]);
    for (const secret of ["Unselected Secret Skill", "Unselected secret result", "Hidden Co", "Hidden bullet"]) expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("institution:"); expect(serialized).not.toContain("start_date:");
  });

  it("persists YAML and loadable PDF, combines that PDF, and leaves human state alone", async () => {
    const job = add(); setReviewStatus(job.job_id, "INTERESTED"); persistJobAnalysis(job.job_id, rawAnalysis(job.job_id));
    let argv: string[] = []; const fake = await fakeRenderCV();
    const files = await generateMaterials(job.job_id, (args) => { argv = args; fake(args); });
    expect(argv).toEqual(expect.arrayContaining(["render", "--dont-generate-markdown", "--dont-generate-png"]));
    expect(YAML.parse(fs.readFileSync(files.resumeYaml, "utf8")).cv.sections.Skills).toEqual(["TypeScript"]);
    expect((await PDFDocument.load(fs.readFileSync(files.resumePdf))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(fs.readFileSync(files.packagePdf))).getPageCount()).toBe(2);
    expect(materialArtifacts(job).map((artifact) => artifact.key)).toEqual(["resumeYaml", "resumePdf", "letterPdf", "letterDocx", "packagePdf"]);
    expect(fs.existsSync(path.join(path.dirname(files.resumePdf), "resume.docx"))).toBe(false);
    expect(db().prepare("SELECT material_status,review_status,application_status FROM jobs WHERE id=?").get(job.id)).toEqual({ material_status: "READY", review_status: "INTERESTED", application_status: "NOT_APPLIED" });
  });

  it("blocks missing analysis and invalid plan references before the runner", async () => {
    const job = add(); setReviewStatus(job.job_id, "INTERESTED");
    await expect(generateMaterials(job.job_id, () => { throw new Error("runner should not run"); })).rejects.toThrow("EVALUATION_REQUIRED");
    const invalid = rawAnalysis(job.job_id); invalid.tailoringPlan.skillIndexes = [9];
    expect(() => persistJobAnalysis(job.job_id, invalid)).toThrow("unsupported skill");
    expect(db().prepare("SELECT material_status FROM jobs WHERE id=?").get(job.id)).toEqual({ material_status: "NOT_GENERATED" });
  });

  it("blocks an invalidated analysis after a substantive source upgrade", async () => {
    const job = add(); setReviewStatus(job.job_id, "INTERESTED"); persistJobAnalysis(job.job_id, rawAnalysis(job.job_id));
    db().prepare("UPDATE jobs SET analysis_json=NULL WHERE id=?").run(job.id);
    await expect(generateMaterials(job.job_id, () => { throw new Error("runner should not run"); })).rejects.toThrow("EVALUATION_REQUIRED");
    expect(db().prepare("SELECT material_status FROM jobs WHERE id=?").get(job.id)).toEqual({ material_status: "NOT_GENERATED" });
  });

  it("audits renderer failure without exposing partial output or success", async () => {
    const job = add(); setReviewStatus(job.job_id, "INTERESTED"); persistJobAnalysis(job.job_id, rawAnalysis(job.job_id));
    await expect(generateMaterials(job.job_id, () => { throw new Error("renderer failed"); })).rejects.toThrow("renderer failed");
    expect(db().prepare("SELECT material_status,application_status FROM jobs WHERE id=?").get(job.id)).toEqual({ material_status: "ERROR", application_status: "NOT_APPLIED" });
    expect(db().prepare("SELECT action FROM audit_events WHERE job_id=? ORDER BY id DESC LIMIT 1").get(job.id)).toEqual({ action: "MATERIAL_GENERATION_ERROR" });
    expect(materialArtifacts(job)).toEqual([]);
  });

  it("validates the renderer PDF before installing a canonical artifact", async () => {
    const job = add(); const analysis = persistJobAnalysis(job.job_id, rawAnalysis(job.job_id));
    await expect(renderResume(profile, analysis, path.join(temporary, "resume"), () => {})).rejects.toThrow("nontrivial PDF");
    expect(fs.existsSync(path.join(temporary, "resume", "resume.pdf"))).toBe(false);
  });
});
