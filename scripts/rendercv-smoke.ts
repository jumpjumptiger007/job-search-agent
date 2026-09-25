import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { PDFDocument } from "pdf-lib";
import { closeDb } from "../lib/db";
import { ingest, setReviewStatus } from "../lib/jobs";
import { persistJobAnalysis } from "../lib/agent-workflow";
import { generateMaterials } from "../lib/materials";

async function main() {
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rendercv-gate6-smoke-"));
try {
  process.env.JOB_AGENT_DB_PATH = path.join(temporary, "jobs.sqlite");
  process.env.JOB_AGENT_STORAGE_ROOT = temporary;
  fs.mkdirSync(path.join(temporary, "profile"));
  fs.writeFileSync(path.join(temporary, "profile", "profile.yaml"), YAML.stringify({ name: "Test Candidate", email: "test@example.com", summary: "Factual test summary.", skills: ["TypeScript", "Unselected skill"], experience: [{ employer: "Acme", title: "Engineer", dates: "Spring 2020 to Autumn 2024", bullets: ["Built TypeScript services.", "Unselected bullet."] }], education: ["Degree, Acme University, 2019"] }));
  const job = ingest({ company: "Acme", title: "Engineer", url: "https://careers.example/rendercv-smoke", sourceName: "Careers", description: "TypeScript engineering" }).job;
  setReviewStatus(job.job_id, "INTERESTED");
  persistJobAnalysis(job.job_id, { schemaVersion: "v0.7", jobId: job.job_id, role: { archetype: "Engineer" }, requirements: [{ text: "TypeScript", evidence: "TypeScript" }], matches: [{ requirement: "TypeScript", candidateFactRefs: [{ kind: "skill", index: 0 }] }], gaps: [], germanyDachConsiderations: [], strengths: [{ kind: "skill", index: 0 }], keywords: [{ text: "TypeScript", priority: 1, evidence: "TypeScript" }], tailoringPlan: { skillIndexes: [0], experiences: [{ index: 0, bulletIndexes: [0] }], keywords: ["TypeScript"] }, evaluation: { score: 4 }, provenance: { candidateSource: "profile/profile.yaml", approvedFactRefs: [{ kind: "skill", index: 0 }, { kind: "experience", index: 0 }, { kind: "experienceBullet", index: 0, bulletIndex: 0 }] }, unsupportedClaims: [] });
  const files = await generateMaterials(job.job_id);
  const pdf = await PDFDocument.load(fs.readFileSync(files.resumePdf));
  if (pdf.getPageCount() < 1 || fs.statSync(files.resumePdf).size < 100) throw new Error("Smoke PDF validation failed");
  const packagePdf = await PDFDocument.load(fs.readFileSync(files.packagePdf));
  if (packagePdf.getPageCount() <= pdf.getPageCount()) throw new Error("Smoke package PDF validation failed");
  console.log(`RenderCV smoke: OK (${pdf.getPageCount()} resume page, ${fs.statSync(files.resumePdf).size} bytes; ${packagePdf.getPageCount()} package pages)`);
} finally { closeDb(); fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
