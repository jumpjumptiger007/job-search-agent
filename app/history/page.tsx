import Link from "next/link";
import { canonicalEvaluationScore, historyJobs, type HistoryFilter } from "@/lib/dashboard";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
const filters: HistoryFilter[] = ["all", "skipped", "rejected", "withdrawn"];

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const params = await searchParams;
  const filter = filters.includes(params.filter as HistoryFilter) ? params.filter as HistoryFilter : "all";
  const query = typeof params.q === "string" ? params.q : "";
  const jobs = historyJobs(listJobs(), filter, query);
  return <main id="main-content" tabIndex={-1} className="history-page"><section className="page-intro"><div><h2>Historical records</h2><p>Skipped and closed jobs remain available for reference.</p></div><span>{jobs.length} {jobs.length === 1 ? "record" : "records"}</span></section>
    <form className="history-toolbar" action="/history"><label>Search records<input aria-label="Search history" type="search" name="q" defaultValue={query} placeholder="JOB ID, role, company, location" /></label><label>Type<select name="filter" defaultValue={filter}><option value="all">All history</option><option value="skipped">Skipped</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select></label><button type="submit">Search</button></form>
    <div className="table-scroll"><table className="data-table history-table"><thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Evaluation</th><th>Closed as</th><th>Updated</th><th>Open</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.job_id}><td><Link className="table-role" href={`/jobs/${encodeURIComponent(job.job_id)}`}>{job.title}</Link><small>{job.job_id}</small></td><td>{job.company}</td><td>{job.location || "—"}</td><td>{canonicalEvaluationScore(job) ?? "—"}{canonicalEvaluationScore(job) === undefined ? "" : " / 5"}</td><td>{job.review_status === "SKIPPED" ? "Skipped" : job.application_status === "REJECTED" ? "Rejected" : job.application_status === "WITHDRAWN" ? "Withdrawn" : "Closed"}</td><td>{job.updated_at || job.found_at || "—"}</td><td><Link href={`/jobs/${encodeURIComponent(job.job_id)}`}>Open</Link></td></tr>)}</tbody></table></div>{jobs.length === 0 && <p className="table-empty">No historical records match this search.</p>}
  </main>;
}
