import { isActive, isClosed, isReadyToApply } from "./core/job-workflow";

export type DashboardJob = Record<string, any>;
export type TailorCondition = "Needs analysis" | "Ready to generate" | "Generation error" | "Blocked: insufficient source";
export type NextStepStage = "Review" | "Blocked" | "Analyze" | "Materials" | "Apply" | "Active" | "History";
export type NextStepAction = "review" | "source" | "analyze" | "materials" | "retry-materials" | "apply" | "track" | "none";
export type JobNextStep = { stage: NextStepStage; title: string; description: string; action: NextStepAction };

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

export function codexPrompt(jobId: string) {
  return `Analyze ${jobId} using the job-agent workflow.`;
}

export function jobNextStep(job: DashboardJob, hasUsableAnalysis = canonicalEvaluationScore(job) !== undefined): JobNextStep {
  if (job.review_status === "SKIPPED" || ["REJECTED", "WITHDRAWN"].includes(job.application_status)) return { stage: "History", title: job.application_status === "REJECTED" || job.application_status === "WITHDRAWN" ? "Application closed" : "No action required", description: "This job is retained in history.", action: "none" };
  if (job.application_status === "APPLIED") return { stage: "Active", title: "Application submitted — keep status current", description: "Update the application status as it progresses.", action: "track" };
  if (job.application_status === "INTERVIEW") return { stage: "Active", title: "Interview stage — keep status current", description: "Update the application status as it progresses.", action: "track" };
  if (job.application_status === "OFFER") return { stage: "Active", title: "Offer recorded", description: "Keep the application status current.", action: "track" };
  if (job.review_status === "PENDING") return { stage: "Review", title: "Review this job", description: "Interested means you want to continue evaluating and preparing this role. Skip removes it from active work.", action: "review" };
  if (job.review_status === "INTERESTED" && job.content_status === "INSUFFICIENT") return { stage: "Blocked", title: "Source content is insufficient", description: "Captured content is not sufficient for normal analysis or material generation.", action: "source" };
  if (job.review_status === "INTERESTED" && !hasUsableAnalysis) return { stage: "Analyze", title: "Analyze this job in Codex Desktop", description: "A validated analysis is required before application materials can be generated.", action: "analyze" };
  if (isReadyToApply(job)) return { stage: "Apply", title: "Ready for manual application", description: "Submit the application on the employer's website. Job Search Agent never submits applications automatically.", action: "apply" };
  if (job.review_status === "INTERESTED" && job.material_status !== "READY") return job.material_status === "ERROR" ? { stage: "Materials", title: "Material generation failed", description: "Review the source and retry generation when ready.", action: "retry-materials" } : { stage: "Materials", title: "Generate application materials", description: "Validated analysis is ready for factual material generation.", action: "materials" };
  return { stage: "History", title: "No action required", description: "This job is retained in history.", action: "none" };
}

export function tailorCondition(job: DashboardJob): TailorCondition {
  if (job.content_status === "INSUFFICIENT") return "Blocked: insufficient source";
  if (job.material_status === "ERROR") return "Generation error";
  return canonicalEvaluationScore(job) === undefined ? "Needs analysis" : "Ready to generate";
}

export function materialActionLabel(job: DashboardJob, analysis: unknown) {
  if (job.review_status !== "INTERESTED" || job.content_status === "INSUFFICIENT" || !analysis) return undefined;
  return job.material_status === "READY" ? "Regenerate materials" : "Generate materials";
}

export function dashboardWorkflow(jobs: DashboardJob[], hasUsableAnalysis = (job: DashboardJob) => canonicalEvaluationScore(job) !== undefined) {
  const open = (job: DashboardJob) => !isActive(job) && !isClosed(job);
  const interested = jobs.filter((job) => job.review_status === "INTERESTED" && open(job));
  const stage = (job: DashboardJob) => jobNextStep(job, hasUsableAnalysis(job)).stage;
  const analyze = interested.filter((job) => ["Blocked", "Analyze"].includes(stage(job)));
  const materials = interested.filter((job) => stage(job) === "Materials");
  return {
    review: jobs.filter((job) => job.review_status === "PENDING" && open(job)),
    analyze,
    materials,
    apply: jobs.filter((job) => open(job) && stage(job) === "Apply"),
    active: jobs.filter(isActive),
    historical: jobs.filter(isClosed),
    tailor: interested.filter((job) => job.material_status !== "READY"),
  };
}

export function discoverySummary(run: Record<string, any> | undefined) {
  if (!run) return undefined;
  if (Number.isFinite(run.filtered_candidates) && Number.isFinite(run.accepted_candidates)) return `${run.filtered_candidates + run.accepted_candidates} checked · ${run.filtered_candidates} filtered · ${run.new_jobs} new · ${run.duplicates} duplicates`;
  return `${run.new_jobs} new · ${run.duplicates} duplicates`;
}

export function discoveryRunPresentation(run: Record<string, any>) {
  const issues = Number(run.failures) > 0 || Boolean(String(run.errors || "").trim());
  if (!run.ended_at) return { status: "Running", message: "Discovery is still processing configured sources." };
  if (issues) return { status: "Completed with issues", message: "Provider or configuration issues occurred. Review the run details below." };
  if (run.new_jobs === 0) return { status: "Completed", message: "Discovery completed normally. Matching jobs may already have been filtered or deduplicated." };
  return { status: "Completed", message: run.sources_attempted || "Discovery completed." };
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
