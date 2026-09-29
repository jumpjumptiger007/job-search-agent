import { describe, expect, it } from "vitest";
import { canonicalEvaluationScore, codexPrompt, dashboardWorkflow, discoveryRunPresentation, discoverySummary, evaluationLabel, exportRows, isLowFitEvaluation, jobNextStep, materialActionLabel, tailorCondition } from "../lib/dashboard";

const job = (overrides: Record<string, any> = {}) => ({ job_id: "JOB-0001", company: "Acme", title: "Engineer", review_status: "INTERESTED", application_status: "NOT_APPLIED", material_status: "NOT_GENERATED", content_status: "SUBSTANTIVE", score: 97, analysis_json: JSON.stringify({ evaluation: { score: 4.5 } }), ...overrides });

describe("v0.7 Gate 8 dashboard presentation", () => {
  it("uses the canonical 1–5 score and never the legacy score", () => {
    expect(canonicalEvaluationScore(job())).toBe(4.5);
    expect(evaluationLabel(job({ analysis_json: null }))).toBe("Not analyzed");
    expect(evaluationLabel(job({ analysis_json: "not json", score: 12 }))).toBe("Not analyzed");
    expect(evaluationLabel(job({ analysis_json: JSON.stringify({ evaluation: { score: 9 } }), score: 88 }))).toBe("Not analyzed");
  });

  it("keeps insufficient interested jobs visible as blocked tailoring work", () => {
    const blocked = job({ job_id: "JOB-0002", content_status: "INSUFFICIENT" });
    expect(dashboardWorkflow([blocked]).tailor).toEqual([blocked]);
    expect(tailorCondition(blocked)).toBe("Blocked: insufficient source");
  });

  it("represents material-ready jobs in Apply and separates active and closed jobs", () => {
    const ready = job({ job_id: "JOB-0003", material_status: "READY" });
    const active = job({ job_id: "JOB-0004", application_status: "INTERVIEW" });
    const closed = job({ job_id: "JOB-0005", application_status: "REJECTED" });
    const queues = dashboardWorkflow([ready, active, closed]);
    expect(queues.apply).toEqual([ready]);
    expect(queues.active).toEqual([active]);
    expect(queues.historical).toEqual([closed]);
  });

  it("exports the canonical score with a user-facing 1–5 column", () => {
    const row = exportRows([job({ score: 100 })])[0];
    expect(row).toMatchObject({ "Evaluation Score (1–5)": "4.5 / 5" });
    expect(row).not.toHaveProperty("Match Score");
  });

  it("withholds the material action until canonical analysis is usable", () => {
    expect(materialActionLabel(job(), undefined)).toBeUndefined();
    expect(materialActionLabel(job(), { evaluation: { score: 4.5 } })).toBe("Generate materials");
    expect(materialActionLabel(job({ material_status: "READY" }), { evaluation: { score: 4.5 } })).toBe("Regenerate materials");
    expect(materialActionLabel(job({ content_status: "INSUFFICIENT" }), { evaluation: { score: 4.5 } })).toBeUndefined();
  });

  it("projects every operational state without changing workflow state", () => {
    expect(jobNextStep(job({ review_status: "PENDING" }))).toMatchObject({ stage: "Review", title: "Review this job", action: "review" });
    expect(jobNextStep(job({ content_status: "INSUFFICIENT" }))).toMatchObject({ stage: "Blocked", title: "Source content is insufficient", action: "source" });
    expect(jobNextStep(job({ analysis_json: null }))).toMatchObject({ stage: "Analyze", action: "analyze" });
    expect(jobNextStep(job())).toMatchObject({ stage: "Materials", action: "materials" });
    expect(jobNextStep(job({ material_status: "READY" }))).toMatchObject({ stage: "Apply", title: "Ready for manual application", action: "apply" });
    expect(jobNextStep(job({ application_status: "APPLIED" }))).toMatchObject({ stage: "Active", title: "Application submitted — keep status current", action: "track" });
    expect(jobNextStep(job({ application_status: "INTERVIEW" }))).toMatchObject({ stage: "Active", title: "Interview stage — keep status current", action: "track" });
    expect(jobNextStep(job({ application_status: "OFFER" }))).toMatchObject({ stage: "Active", title: "Offer recorded", action: "track" });
    expect(jobNextStep(job({ review_status: "SKIPPED" }))).toMatchObject({ stage: "History", action: "none" });
    expect(jobNextStep(job({ application_status: "REJECTED" }))).toMatchObject({ stage: "History", title: "Application closed", action: "none" });
  });

  it("uses complete modern diagnostics and an honest legacy discovery summary", () => {
    expect(codexPrompt("JOB-0042")).toBe("Analyze JOB-0042 using the job-agent workflow.");
    expect(discoverySummary({ jobs_seen: 5, filtered_candidates: 16, accepted_candidates: 5, new_jobs: 3, duplicates: 2 })).toBe("21 checked · 16 filtered · 3 new · 2 duplicates");
    expect(discoverySummary({ jobs_seen: 5, filtered_candidates: null, accepted_candidates: null, new_jobs: 3, duplicates: 2 })).toBe("3 new · 2 duplicates");
  });

  it("distinguishes normal zero-new completion from completed runs with issues", () => {
    expect(discoveryRunPresentation({ ended_at: "2026-09-27", new_jobs: 0, failures: 0, errors: "" })).toMatchObject({ status: "Completed", message: expect.stringContaining("completed normally") });
    expect(discoveryRunPresentation({ ended_at: "2026-09-27", new_jobs: 0, failures: 1, errors: "Provider failed" })).toMatchObject({ status: "Completed with issues" });
    expect(discoveryRunPresentation({ ended_at: "2026-09-27", new_jobs: 0, failures: 1, errors: "Provider failed" }).message).not.toContain("completed normally");
  });

  it("uses the same usable-analysis decision for Dashboard queues and Job Detail", () => {
    const scoreLooking = job({ analysis_json: JSON.stringify({ evaluation: { score: 4.5 } }) });
    expect(jobNextStep(scoreLooking, false)).toMatchObject({ stage: "Analyze", action: "analyze" });
    expect(dashboardWorkflow([scoreLooking], () => false).analyze).toEqual([scoreLooking]);
    expect(dashboardWorkflow([scoreLooking], () => false).materials).toEqual([]);
    expect(jobNextStep(scoreLooking, true)).toMatchObject({ stage: "Materials", action: "materials" });
    expect(dashboardWorkflow([scoreLooking], () => true).materials).toEqual([scoreLooking]);
  });

  it("cautions on low-fit materials without blocking the Materials workflow", () => {
    for (const score of [2, 2.5]) {
      const lowFit = job({ job_id: `LOW-${score}`, analysis_json: JSON.stringify({ evaluation: { score } }) });
      expect(isLowFitEvaluation(lowFit)).toBe(true);
      expect(jobNextStep(lowFit)).toMatchObject({
        stage: "Materials",
        title: "Low fit — review gaps before generating materials",
        description: expect.stringContaining("scored below 3/5"),
        action: "materials",
      });
      expect(dashboardWorkflow([lowFit]).materials).toEqual([lowFit]);
    }
  });

  it("keeps the ordinary Materials presentation at scores of 3 and above", () => {
    for (const score of [3, 4.5, 5]) {
      const normalFit = job({ analysis_json: JSON.stringify({ evaluation: { score } }) });
      expect(isLowFitEvaluation(normalFit)).toBe(false);
      expect(jobNextStep(normalFit)).toMatchObject({
        stage: "Materials",
        title: "Generate application materials",
        action: "materials",
      });
    }
  });

  it("keeps missing or unusable analysis in Analyze", () => {
    for (const analysis_json of [null, "not json", JSON.stringify({ evaluation: { score: 0 } })]) {
      expect(jobNextStep(job({ analysis_json }))).toMatchObject({ stage: "Analyze", action: "analyze" });
    }
  });
});
