import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { POST as reviewPost } from "../app/api/jobs/[id]/review/route";
import { POST as applicationPost } from "../app/api/jobs/[id]/application/route";
import { closeDb, db } from "../lib/db";
import { ingest, getJob } from "../lib/jobs";
import { saveReviewStatuses } from "../lib/review-actions";

const file = path.join("/private/tmp", "jobs-and-applications-routes.sqlite");
beforeEach(() => { closeDb(); process.env.JOB_AGENT_DB_PATH = file; fs.rmSync(file, { force: true }); });
afterEach(() => { closeDb(); fs.rmSync(file, { force: true }); });

function addJob() {
  return ingest({ company: "Acme", title: "Engineer", url: "https://careers.example/engineer", sourceName: "Careers", description: "German and English required" }).job;
}

function request(jobId: string, status: string, endpoint: "review" | "application", accept = "application/json") {
  const body = new FormData();
  body.set("status", status);
  return new Request(`http://localhost/api/jobs/${jobId}/${endpoint}`, { method: "POST", headers: { accept }, body });
}

describe("review route JSON support", () => {
  it("updates through the existing review function and returns JSON for list actions", async () => {
    const job = addJob();
    const response = await reviewPost(request(job.job_id, "INTERESTED", "review"), { params: Promise.resolve({ id: job.job_id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, jobId: job.job_id, status: "INTERESTED" });
    expect(getJob(job.job_id).review_status).toBe("INTERESTED");
    expect(db().prepare("SELECT action FROM audit_events WHERE job_id=? ORDER BY id DESC LIMIT 1").get(job.id)).toEqual({ action: "REVIEW_INTERESTED" });
  });

  it("keeps ordinary form redirects and rejects invalid JSON review values", async () => {
    const job = addJob();
    const formResponse = await reviewPost(request(job.job_id, "SKIPPED", "review", "text/html"), { params: Promise.resolve({ id: job.job_id }) });
    expect(formResponse.status).toBe(303);
    expect(formResponse.headers.get("location")).toBe(`http://localhost/jobs/${job.job_id}`);

    const invalid = await reviewPost(request(job.job_id, "DELETE", "review"), { params: Promise.resolve({ id: job.job_id }) });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "Invalid review status" });
    expect(getJob(job.job_id).review_status).toBe("SKIPPED");
  });
});

describe("application route JSON support", () => {
  it("records lifecycle changes and returns validation errors without changing form semantics", async () => {
    const job = addJob();
    const response = await applicationPost(request(job.job_id, "APPLIED", "application"), { params: Promise.resolve({ id: job.job_id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, jobId: job.job_id, status: "APPLIED" });
    expect(getJob(job.job_id).application_status).toBe("APPLIED");
    expect(db().prepare("SELECT action FROM audit_events WHERE job_id=? ORDER BY id DESC LIMIT 1").get(job.id)).toEqual({ action: "APPLICATION_STATUS_CHANGED" });

    const invalid = await applicationPost(request(job.job_id, "MADE_UP", "application"), { params: Promise.resolve({ id: job.job_id }) });
    expect(invalid.status).toBe(400);
    expect(getJob(job.job_id).application_status).toBe("APPLIED");
  });

  it("preserves the READY_TO_APPLY guard for list controls", async () => {
    const job = addJob();
    const response = await applicationPost(request(job.job_id, "READY_TO_APPLY", "application"), { params: Promise.resolve({ id: job.job_id }) });
    expect(response.status).toBe(400);
    expect(getJob(job.job_id).application_status).toBe("NOT_APPLIED");
  });
});

describe("safe batch review actions", () => {
  it("applies only the requested review status and reports partial failures", async () => {
    const calls: Array<[string, string]> = [];
    const result = await saveReviewStatuses(["JOB-0100", "JOB-0101", "JOB-0102"], "SKIPPED", async (jobId, status) => {
      calls.push([jobId, status]);
      if (jobId === "JOB-0101") throw new Error("Not found");
    });

    expect(calls).toEqual([["JOB-0100", "SKIPPED"], ["JOB-0101", "SKIPPED"], ["JOB-0102", "SKIPPED"]]);
    expect(result.succeeded).toEqual(["JOB-0100", "JOB-0102"]);
    expect(result.failed).toEqual([{ jobId: "JOB-0101", ok: false, message: "Not found" }]);
  });
});
