import { describe, expect, it } from "vitest";
import { canonicalEvaluationScore, dashboardWorkflow, evaluationLabel, exportRows, materialActionLabel, tailorCondition } from "../lib/dashboard";

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
});
