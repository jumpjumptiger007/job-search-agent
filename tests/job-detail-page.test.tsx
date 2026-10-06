import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import JobPage from "../app/jobs/[id]/page";
import { closeDb, db } from "../lib/db";
import { ingest, setReviewStatus } from "../lib/jobs";
import { persistJobAnalysis } from "../lib/agent-workflow";

const dbFile = "/private/tmp/job-detail-page.sqlite";
const store = "/private/tmp/job-detail-page-store";
const oldDb = process.env.JOB_AGENT_DB_PATH;
const oldStore = process.env.JOB_AGENT_STORAGE_ROOT;
const profileText = "name: Private Candidate\nemail: candidate@example.test\nskills: [TypeScript, SQL]\nsummary: Private profile summary.\nexperience:\n  - employer: Acme\n    title: Engineer\n    bullets: [Built TypeScript services.]\n";
const jd = "Senior Engineer in Berlin. Hybrid work. German and English required. TypeScript services.";

beforeEach(() => {
  closeDb();
  process.env.JOB_AGENT_DB_PATH = dbFile;
  process.env.JOB_AGENT_STORAGE_ROOT = store;
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(store, { recursive: true, force: true });
  fs.mkdirSync(path.join(store, "profile"), { recursive: true });
  fs.writeFileSync(path.join(store, "profile", "profile.yaml"), profileText);
});
afterEach(() => {
  closeDb();
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(store, { recursive: true, force: true });
  if (oldDb === undefined) delete process.env.JOB_AGENT_DB_PATH; else process.env.JOB_AGENT_DB_PATH = oldDb;
  if (oldStore === undefined) delete process.env.JOB_AGENT_STORAGE_ROOT; else process.env.JOB_AGENT_STORAGE_ROOT = oldStore;
});

function add(contentStatus: "SUBSTANTIVE" | "INSUFFICIENT" = "SUBSTANTIVE") {
  return ingest({ company: "Acme", title: `Senior Engineer ${Math.random()}`, location: "Berlin", workModel: "Hybrid", url: `https://careers.example/role-${Math.random()}`, sourceName: "Careers", description: jd, contentStatus }).job;
}

function analysis(jobId: string, score = 4.5) {
  return {
    schemaVersion: "v0.7", jobId,
    role: { archetype: "Engineering", seniority: { text: "Senior", evidence: "Senior Engineer" }, workModel: { text: "Hybrid", evidence: "Hybrid work" }, location: { text: "Berlin", evidence: "Berlin" } },
    requirements: [{ text: "German and English", evidence: "German and English required" }, { text: "TypeScript services", evidence: "TypeScript services" }],
    matches: [{ requirement: "TypeScript services", candidateFactRefs: [{ kind: "skill", index: 0 }, { kind: "experienceBullet", index: 0, bulletIndex: 0 }] }],
    gaps: [{ text: "German fluency is not supported", evidence: "German and English required" }],
    germanyDachConsiderations: [{ topic: "language", evidence: "German and English required" }, { topic: "workModel", evidence: "Hybrid work" }],
    strengths: [{ kind: "skill", index: 0 }], keywords: [{ text: "TypeScript", priority: 1, evidence: "TypeScript services" }],
    tailoringPlan: { skillIndexes: [0], experiences: [{ index: 0, bulletIndexes: [0] }], keywords: ["TypeScript"] },
    evaluation: { score }, provenance: { candidateSource: "profile/profile.yaml", approvedFactRefs: [{ kind: "skill", index: 0 }, { kind: "experience", index: 0 }, { kind: "experienceBullet", index: 0, bulletIndex: 0 }] }, unsupportedClaims: [],
  };
}

async function page(jobId: string) {
  return renderToStaticMarkup(await JobPage({ params: Promise.resolve({ id: jobId }) }));
}

describe("Job Detail presentation", () => {
  it("shows honest pre-analysis information and review actions without empty analysis sections", async () => {
    const job = add();
    const html = await page(job.job_id);
    expect(html).toContain("Back to Jobs");
    expect(html).toContain("Job information");
    expect(html).toContain("Validated analysis is not available");
    expect(html).toContain("Mark Interested");
    expect(html).toContain("Skip");
    expect(html).toContain("Captured JD and source evidence");
    for (const absent of [">Requirements &amp; candidate match<", ">Gaps<", ">Keywords<", "0 / 5", "legacy score"]) expect(html).not.toContain(absent);
  });

  it("offers the Codex workflow only after review and blocks insufficient source content", async () => {
    const interested = add();
    setReviewStatus(interested.job_id, "INTERESTED");
    const eligibleHtml = await page(interested.job_id);
    expect(eligibleHtml).toContain("Analyze JOB-");
    expect(eligibleHtml).toContain("Validated analysis is required before materials can be generated");
    expect(eligibleHtml).not.toContain(`/api/jobs/${interested.job_id}/generate`);

    const insufficient = add("INSUFFICIENT");
    setReviewStatus(insufficient.job_id, "INTERESTED");
    const blockedHtml = await page(insufficient.job_id);
    expect(blockedHtml).toContain("Source content is insufficient");
    expect(blockedHtml).toContain("Codex analysis is unavailable");
    expect(blockedHtml).not.toContain("Copy Codex prompt");
    expect(blockedHtml).not.toContain(`/api/jobs/${insufficient.job_id}/generate`);
  });

  it("renders only validated analysis and resolves only its approved candidate references", async () => {
    const job = add();
    setReviewStatus(job.job_id, "INTERESTED");
    persistJobAnalysis(job.job_id, analysis(job.job_id));
    const html = await page(job.job_id);
    expect(html).toContain("4.5 / 5");
    expect(html).toContain("Requirements &amp; candidate match");
    expect(html).toContain("Matched");
    expect(html).toContain("No match recorded");
    expect(html).toContain("German fluency is not supported");
    expect(html).toContain("Germany / DACH considerations");
    expect(html).toContain("JD evidence: Hybrid work");
    expect(html).toContain("TypeScript");
    expect(html).toContain("Built TypeScript services.");
    expect(html).not.toContain("Private Candidate");
    expect(html).not.toContain("candidate@example.test");
    expect(html).not.toContain("Private profile summary.");
  });

  it("preserves low-fit material caution and keeps generation available", async () => {
    const job = add();
    setReviewStatus(job.job_id, "INTERESTED");
    persistJobAnalysis(job.job_id, analysis(job.job_id, 2.5));
    const html = await page(job.job_id);
    expect(html).toContain("Low fit (2.5 / 5)");
    expect(html).toContain("Review the documented gaps before generating materials");
    expect(html).toContain("Generate Materials Anyway");
    expect(html).toContain(`/api/jobs/${job.job_id}/generate`);
  });

  it("lists existing artifacts and keeps ready/active application tracking manual", async () => {
    const job = add();
    setReviewStatus(job.job_id, "INTERESTED");
    persistJobAnalysis(job.job_id, analysis(job.job_id));
    const pdf = path.join(store, job.folder_path, "resume", "resume.pdf");
    fs.mkdirSync(path.dirname(pdf), { recursive: true });
    fs.writeFileSync(pdf, "existing generated pdf");
    db().prepare("UPDATE jobs SET material_status='READY',application_status='READY_TO_APPLY' WHERE job_id=?").run(job.job_id);
    const ready = await page(job.job_id);
    expect(ready).toContain("Resume PDF");
    expect(ready).toContain("READY TO APPLY");
    expect(ready).toContain("Save status");
    expect(ready).toContain("never submits applications");
    expect(ready).toContain(job.canonical_url);

    db().prepare("UPDATE jobs SET application_status='INTERVIEW' WHERE job_id=?").run(job.job_id);
    const active = await page(job.job_id);
    expect(active).toContain("INTERVIEW");
    expect(active).toContain("Application status");
    expect(active).toContain("Resume PDF");
    expect(active).not.toContain(`/api/jobs/${job.job_id}/generate`);
    expect(active).not.toContain("Regenerate materials");
    expect(active).not.toContain("Skip this job");
  });

  it("does not treat invalid raw analysis JSON as validated or offer actions to history records", async () => {
    const job = add();
    setReviewStatus(job.job_id, "INTERESTED");
    db().prepare("UPDATE jobs SET analysis_json=? WHERE job_id=?").run(JSON.stringify({ evaluation: { score: 5 }, role: { archetype: "Invented" } }), job.job_id);
    const invalid = await page(job.job_id);
    expect(invalid).toContain("Not analyzed");
    expect(invalid).not.toContain("Invented");
    expect(invalid).not.toContain("5 / 5");

    db().prepare("UPDATE jobs SET application_status='REJECTED' WHERE job_id=?").run(job.job_id);
    const historical = await page(job.job_id);
    expect(historical).toContain("Application closed");
    expect(historical).not.toContain("Skip this job");
    expect(historical).not.toContain(`/api/jobs/${job.job_id}/generate`);
  });
});
