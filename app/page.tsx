import { readUsableJobAnalysis } from "@/lib/agent-workflow";
import { dashboardWorkflow, discoveryRunPresentation, discoverySummary, evaluationLabel, jobNextStep } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { listJobs } from "@/lib/jobs";
import { DiscoveryActions, DiscoveryForm } from "./discovery-actions";

export const dynamic = "force-dynamic";

const badge = (value: string) => <span className={`badge badge-${value.toLowerCase()}`}>{value.replaceAll("_", " ")}</span>;

function JobItem({ job, isUsable }: { job: any; isUsable: (job: any) => boolean }) {
  const next = jobNextStep(job, isUsable(job));
  return <a className="item" href={`/jobs/${job.job_id}`}>
    <span className="job-id">{job.job_id}</span>
    <span className="item-copy"><b>{job.company} · {job.title}</b><small>{[job.location, job.work_model].filter(Boolean).join(" · ") || "Location and work model not stated"}</small></span>
    <span className="item-meta">{evaluationLabel(job)}</span>
    <span className="item-next"><span>{badge(next.stage)}</span><small>{next.title}</small></span>
  </a>;
}

function Queue({ title, items, emptyTitle, emptyText, isUsable }: { title: string; items: any[]; emptyTitle: string; emptyText: string; isUsable: (job: any) => boolean }) {
  return <section className="queue"><div className="section-heading"><div><p className="eyebrow">WORK QUEUE</p><h2>{title}</h2></div><span className="queue-count">{items.length}</span></div>{items.length ? <div className="item-group">{items.map((job) => <JobItem key={job.job_id} job={job} isUsable={isUsable} />)}</div> : <div className="empty"><b>{emptyTitle}</b><span>{emptyText}</span></div>}</section>;
}

export default function Home() {
  const jobs = listJobs(), usableJobIds = new Set(jobs.filter((job) => Boolean(readUsableJobAnalysis(job.job_id))).map((job) => job.job_id)), isUsable = (job: any) => usableJobIds.has(job.job_id), queues = dashboardWorkflow(jobs, isUsable), runs = db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 3").all() as any[], latestRun = runs[0], latestPresentation = latestRun && discoveryRunPresentation(latestRun);
  const actions = [
    [queues.review.length, "Review discovered jobs", "Choose Interested to continue evaluating a role, or Skip to remove it from active work."],
    [queues.analyze.filter((job) => jobNextStep(job, isUsable(job)).stage === "Analyze").length, "Analyze interested jobs in Codex Desktop", "A validated analysis is required before materials can be generated."],
    [queues.materials.length, "Generate application materials", "Generate factual materials from a validated analysis."],
    [queues.apply.length, "Ready for manual application", "Open the employer posting and submit manually."],
  ].filter(([count]) => count as number > 0);
  return <DiscoveryActions><main>
    <section className="dashboard-intro"><div><p className="eyebrow">LOCAL JOB OPERATIONS</p><h1>Dashboard</h1><p className="muted">Local workflow for discovering, preparing and tracking applications.</p></div><DiscoveryForm source="intro" /></section>
    <section className="workflow-strip" aria-label="Job search workflow"><p>Discovery → Your decision → Codex Desktop → Generate → Apply manually</p><div>{[["Discover", latestRun ? `Last: ${latestRun.new_jobs} new` : "Run discovery"], ["Review", `${queues.review.length} jobs`], ["Analyze", `${queues.analyze.filter((job) => jobNextStep(job, isUsable(job)).stage === "Analyze").length} jobs`], ["Materials", `${queues.materials.length} jobs`], ["Apply", `${queues.apply.length} ready`]].map(([stage, state]) => <section className="workflow-step" key={stage}><b>{stage}</b><small>{state}</small></section>)}</div></section>
    <section className="next-actions"><div className="section-heading"><div><p className="eyebrow">PRIORITY WORK</p><h2>Next actions</h2></div></div>{actions.length ? <div className="item-group">{actions.map(([count, title, detail]) => <div className="item" key={title}><strong className="action-count">{count}</strong><span className="item-copy"><b>{title}</b><small>{detail}</small></span></div>)}</div> : <div className="empty"><b>No current actions</b><span>Run discovery when you are ready to look for new roles.</span></div>}</section>
    <section className="discovery-card"><div><p className="eyebrow">DISCOVERY</p><h2>Find new jobs without duplicating prior work</h2><p className="muted">Discovery searches configured sources, filters candidates, deduplicates matching jobs, and places accepted jobs into Review.</p></div><DiscoveryForm source="card" />{latestRun ? <div className="discovery-result"><b>{latestPresentation.status}</b><strong>{discoverySummary(latestRun)}</strong><p>{latestPresentation.message}{latestRun.errors ? ` ${latestRun.errors}` : ""}</p></div> : <div className="discovery-result"><b>Not run yet</b><p>Run Discovery to search configured sources and create a Review queue.</p></div>}</section>
    <Queue title="Review" items={queues.review} emptyTitle="No jobs need review" emptyText="Discovery adds accepted jobs here for your decision." isUsable={isUsable} />
    <Queue title="Analyze" items={queues.analyze} emptyTitle="No jobs need analysis" emptyText="Jobs you mark Interested will appear here if they still need Codex analysis." isUsable={isUsable} />
    <Queue title="Materials" items={queues.materials} emptyTitle="No jobs need materials" emptyText="Analyzed jobs will appear here when application materials are ready to generate." isUsable={isUsable} />
    <Queue title="Ready to Apply" items={queues.apply} emptyTitle="No jobs are ready to apply" emptyText="Generate materials for an analyzed job first." isUsable={isUsable} />
    <section className="supporting-grid"><section className="supporting-card"><div className="section-heading"><div><p className="eyebrow">TRACKING</p><h2>Active applications</h2></div><span className="queue-count">{queues.active.length}</span></div>{queues.active.length ? <div className="item-group">{queues.active.map((job) => <JobItem key={job.job_id} job={job} isUsable={isUsable} />)}</div> : <p className="muted">Submitted applications remain visible here while active.</p>}</section><section className="supporting-card"><div className="section-heading"><div><p className="eyebrow">RETAINED RECORD</p><h2>History</h2></div><span className="queue-count">{queues.historical.length}</span></div>{queues.historical.length ? <div className="item-group">{queues.historical.map((job) => <JobItem key={job.job_id} job={job} isUsable={isUsable} />)}</div> : <p className="muted">Skipped, rejected, and withdrawn jobs are retained here.</p>}</section></section>
    <section className="operations-grid"><section className="operations-card"><p className="eyebrow">RECENT DISCOVERY</p><h2>Run history</h2>{runs.length ? runs.map((run) => <p key={run.id}><b>{discoveryRunPresentation(run).status}</b> · {discoverySummary(run)}<br /><span className="muted">{run.sources_attempted || "No sources configured"}{run.errors ? ` · ${run.errors}` : ""}</span></p>) : <p className="muted">No discovery runs yet.</p>}</section><section className="operations-card"><p className="eyebrow">EXPORTS</p><h2>Take your data with you</h2><p className="muted">Evaluation scores use the canonical 1–5 analysis model.</p><div className="button-row"><a className="secondary" href="/api/export?format=xlsx">Export XLSX</a><a className="secondary" href="/api/export?format=csv">Export CSV</a></div></section></section>
  </main></DiscoveryActions>;
}
