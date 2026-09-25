import { dashboardWorkflow, evaluationLabel, tailorCondition } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const badge = (value: string) => <span className="badge">{value.replaceAll("_", " ")}</span>;

function JobRow({ job, next }: { job: any; next: React.ReactNode }) {
  return <a className="job-row" href={`/jobs/${job.job_id}`}>
    <span className="job-id">{job.job_id}</span><span className="job-role"><b>{job.company}</b><small>{job.title}</small></span><span className="job-score">{evaluationLabel(job)}</span><span className="job-location">{job.location || "Location not stated"}</span><span className="job-source">{job.canonical_source}</span><span className="job-review">{badge(job.review_status)}</span><span className="job-next">{next}</span>
  </a>;
}

function Queue({ title, items, empty, next }: { title: string; items: any[]; empty: string; next: (job: any) => React.ReactNode }) {
  return <section className="queue"><div className="section-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>{title}</h2></div><span className="queue-count">{items.length}</span></div>{items.length ? <div className="job-list"><div className="job-row job-row-head"><span>ID</span><span>Company / role</span><span>Evaluation</span><span>Location</span><span>Source</span><span>Review</span><span>Next action</span></div>{items.map((job) => <JobRow key={job.job_id} job={job} next={next(job)} />)}</div> : <div className="empty"><b>Nothing here yet</b><span>{empty}</span></div>}</section>;
}

export default function Home() {
  const jobs = listJobs(), queues = dashboardWorkflow(jobs), runs = db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 3").all() as any[], latestRun = runs[0];
  return <main>
    <section className="dashboard-intro"><div><p className="eyebrow">LOCAL JOB OPERATIONS</p><h1>Search. Review. Tailor. Apply.</h1><p className="muted">A compact workspace for the decisions and materials you control. Nothing here submits an application.</p></div><form action="/api/discover" method="post"><button>Run Discovery</button></form></section>
    <section className="workflow-summary" aria-label="Job search workflow"><div className="workflow-step"><span>01</span><div><b>Search</b><small>{latestRun ? `${latestRun.new_jobs} new in the latest run` : "Run a bounded discovery search"}</small></div></div><div className="workflow-step"><span>02</span><div><b>Review</b><small>{queues.review.length} pending decision{queues.review.length === 1 ? "" : "s"}</small></div></div><div className="workflow-step"><span>03</span><div><b>Tailor</b><small>{queues.tailor.length} jobs need analysis or materials</small></div></div><div className="workflow-step"><span>04</span><div><b>Apply</b><small>{queues.apply.length} material-ready jobs</small></div></div></section>
    <section className="setup"><b>Private setup</b><span>Add a factual profile before tailoring. Generated materials contain no invented facts.</span><a href="/api/setup">View checklist</a></section>
    <Queue title="Review" items={queues.review} empty="Run discovery to add jobs for review." next={() => "Choose Interested or Skip"} />
    <Queue title="Tailor" items={queues.tailor} empty="Interested jobs will appear here when they need analysis or materials." next={(job) => tailorCondition(job)} />
    <Queue title="Apply" items={queues.apply} empty="Material-ready jobs will appear here. Setting application status remains a manual decision." next={(job) => job.application_status === "READY_TO_APPLY" ? "Ready for manual application" : "Set application status"} />
    <section className="supporting-grid"><section className="supporting-card"><div className="section-heading"><div><p className="eyebrow">SUPPORTING VIEW</p><h2>Active applications</h2></div><span className="queue-count">{queues.active.length}</span></div>{queues.active.length ? queues.active.map((job) => <a className="supporting-job" href={`/jobs/${job.job_id}`} key={job.job_id}><span><b>{job.company}</b><small>{job.title}</small></span>{badge(job.application_status)}</a>) : <p className="muted">Submitted applications remain visible here while active.</p>}</section><section className="supporting-card"><div className="section-heading"><div><p className="eyebrow">SUPPORTING VIEW</p><h2>History</h2></div><span className="queue-count">{queues.historical.length}</span></div>{queues.historical.length ? queues.historical.map((job) => <a className="supporting-job" href={`/jobs/${job.job_id}`} key={job.job_id}><span><b>{job.company}</b><small>{job.title}</small></span>{badge(job.application_status === "NOT_APPLIED" ? job.review_status : job.application_status)}</a>) : <p className="muted">Skipped, rejected, and withdrawn jobs are retained here.</p>}</section></section>
    <section className="operations-grid"><section className="operations-card"><p className="eyebrow">DISCOVERY ACTIVITY</p><h2>Recent runs</h2>{runs.length ? runs.map((run) => <p key={run.id}><b>{run.ended_at ? "Completed" : "Running"}</b> · {run.new_jobs} new / {run.duplicates} duplicates<br /><span className="muted">{run.sources_attempted || "No sources configured"}{run.errors ? ` · ${run.errors}` : ""}</span></p>) : <p className="muted">No discovery runs yet.</p>}</section><section className="operations-card"><p className="eyebrow">EXPORTS</p><h2>Take your data with you</h2><p className="muted">Evaluation scores use the canonical 1–5 analysis model.</p><div className="button-row"><a className="secondary" href="/api/export?format=xlsx">Export XLSX</a><a className="secondary" href="/api/export?format=csv">Export CSV</a></div></section></section>
  </main>;
}
