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

export function isLowFitEvaluation(job: DashboardJob): boolean {
  const score = canonicalEvaluationScore(job);
  return score !== undefined && score < 3;
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
  if (job.review_status === "INTERESTED" && job.material_status !== "READY") return job.material_status === "ERROR" ? { stage: "Materials", title: "Material generation failed", description: "Review the source and retry generation when ready.", action: "retry-materials" } : hasUsableAnalysis && isLowFitEvaluation(job) ? { stage: "Materials", title: "Low fit — review gaps before generating materials", description: "This role scored below 3/5. Review the documented gaps before deciding whether to continue.", action: "materials" } : { stage: "Materials", title: "Generate application materials", description: "Validated analysis is ready for factual material generation.", action: "materials" };
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

export function overviewCounts(queues: ReturnType<typeof dashboardWorkflow>) {
  return {
    review: queues.review.length,
    analyze: queues.analyze.length,
    materials: queues.materials.length,
    ready: queues.apply.length,
    active: queues.active.length,
    attention: queues.review.length + queues.analyze.length + queues.materials.length + queues.apply.length,
  };
}

export type JobsQueueFilter = "all" | "review" | "analyze" | "materials" | "ready";

export function jobsForQueue(queues: ReturnType<typeof dashboardWorkflow>, filter: JobsQueueFilter) {
  if (filter === "all") {
    return [...queues.review, ...queues.analyze, ...queues.materials, ...queues.apply, ...queues.active];
  }
  const queue = { review: queues.review, analyze: queues.analyze, materials: queues.materials, ready: queues.apply }[filter];
  return queue;
}

export function searchJobs(jobs: DashboardJob[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return jobs;
  return jobs.filter((job) => [job.job_id, job.company, job.title, job.location]
    .some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
}

export type HistoryFilter = "all" | "skipped" | "rejected" | "withdrawn";

/** Refine only the canonical closed/history queue; active jobs cannot enter through a status filter. */
export function historyJobs(jobs: DashboardJob[], filter: HistoryFilter = "all", query = "") {
  const historical = dashboardWorkflow(jobs).historical;
  const filtered = filter === "skipped" ? historical.filter((job) => job.review_status === "SKIPPED")
    : filter === "rejected" ? historical.filter((job) => job.application_status === "REJECTED")
      : filter === "withdrawn" ? historical.filter((job) => job.application_status === "WITHDRAWN") : historical;
  return searchJobs(filtered, query);
}

function discoverySourceDetails(run: Record<string, any>) {
  const errors = String(run.errors || "").split("\n").filter(Boolean);
  const remainingErrors = [...errors];
  const sources = String(run.sources_attempted || "").split(", ").filter(Boolean).map(name => {
    const index = remainingErrors.findIndex(error => error.startsWith(`${name}:`));
    const error = index < 0 ? undefined : remainingErrors.splice(index, 1)[0].slice(name.length + 1).trim();
    return { name, status: error === undefined ? "succeeded" : "failed", error };
  });
  return { sources, unmatchedErrors: remainingErrors };
}

export function discoverySourceOutcomes(run: Record<string, any>) {
  return discoverySourceDetails(run).sources;
}

export function discoveryUnmatchedErrors(run: Record<string, any>) {
  return discoverySourceDetails(run).unmatchedErrors;
}

export function discoverySummary(run: Record<string, any> | undefined) {
  if (!run) return undefined;
  if (discoveryRunPresentation(run).status === "Failed") {
    const sources = discoverySourceOutcomes(run);
    return sources.length ? `0/${sources.length} sources succeeded` : "No usable sources configured";
  }
  if (Number.isFinite(run.filtered_candidates) && Number.isFinite(run.accepted_candidates)) return `${run.filtered_candidates + run.accepted_candidates} checked · ${run.filtered_candidates} filtered · ${run.new_jobs} new · ${run.duplicates} duplicates`;
  return `${run.new_jobs} new · ${run.duplicates} duplicates`;
}

export function discoveryRunPresentation(run: Record<string, any>) {
  const issues = Number(run.failures) > 0 || Boolean(String(run.errors || "").trim());
  if (!run.ended_at) return { status: "Running", message: "Discovery is still processing configured sources." };
  const sources = discoverySourceOutcomes(run);
  // Missing source information in historical rows retains the prior presentation.
  if (run.sources_attempted != null && (!sources.length || sources.every(source => source.status === "failed"))) {
    return { status: "Failed", message: sources.length ? "No attempted source completed successfully. Review the source errors below." : "Enable at least one usable source before running Discovery." };
  }
  if (issues) {
    const succeeded = sources.filter(source => source.status === "succeeded").length;
    const failed = sources.filter(source => source.status === "failed").length;
    if (succeeded && failed) return { status: "Completed with issues", message: `Discovery partly succeeded. ${failed} ${failed === 1 ? "source failed" : "sources failed"} while ${succeeded === 1 ? "the remaining source completed" : "the remaining sources completed"}.` };
    return { status: "Completed with issues", message: "Provider or configuration issues occurred. Review the run details below." };
  }
  if (run.new_jobs === 0) return { status: "Completed", message: "Discovery completed normally. No new jobs were added; matching roles may already have been filtered or deduplicated." };
  const count = Number(run.new_jobs);
  return { status: "Completed", message: `Discovery completed normally. ${count} ${count === 1 ? "job was" : "jobs were"} added to Review.` };
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
