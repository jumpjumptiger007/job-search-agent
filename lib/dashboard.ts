import { isActive, isClosed, isReadyToApply } from "./core/job-workflow";

export type DashboardJob = Record<string, any>;
export type TailorCondition = "Needs analysis" | "Ready to generate" | "Generation error" | "Blocked: insufficient source";

export function canonicalEvaluationScore(job: DashboardJob): number | undefined {
  try {
    const score = JSON.parse(job.analysis_json || "{}").evaluation?.score;
    return typeof score === "number" && Number.isFinite(score) && score >= 1 && score <= 5 ? score : undefined;
  } catch {
    return undefined;
  }
}

export function evaluationLabel(job: DashboardJob) {
  const score = canonicalEvaluationScore(job);
  return score === undefined ? "Not analyzed" : `${score} / 5`;
}

export function tailorCondition(job: DashboardJob): TailorCondition {
  if (job.content_status === "INSUFFICIENT") return "Blocked: insufficient source";
  if (job.material_status === "ERROR") return "Generation error";
  return canonicalEvaluationScore(job) === undefined ? "Needs analysis" : "Ready to generate";
}

export function dashboardWorkflow(jobs: DashboardJob[]) {
  const open = (job: DashboardJob) => !isActive(job) && !isClosed(job);
  return {
    review: jobs.filter((job) => job.review_status === "PENDING" && open(job)),
    tailor: jobs.filter((job) => job.review_status === "INTERESTED" && job.material_status !== "READY" && open(job)),
    apply: jobs.filter((job) => isReadyToApply(job) && open(job)),
    active: jobs.filter(isActive),
    historical: jobs.filter(isClosed),
  };
}

export function exportRows(jobs: DashboardJob[]) {
  return jobs.map((job) => ({
    "Job ID": job.job_id,
    Company: job.company,
    Role: job.title,
    "Evaluation Score (1–5)": evaluationLabel(job),
    Location: job.location,
    "Work Model": job.work_model,
    Posted: job.posted_at,
    Found: job.found_at,
    "Canonical Source": job.canonical_source,
    ATS: job.ats,
    "Material Status": job.material_status,
    "Review Status": job.review_status,
    "Application Status": job.application_status,
    Priority: job.priority,
    Notes: job.notes,
  }));
}
