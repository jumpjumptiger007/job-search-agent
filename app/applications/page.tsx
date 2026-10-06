import Link from "next/link";
import { isReadyToApply } from "@/lib/core/job-workflow";
import { evaluationLabel } from "@/lib/dashboard";
import { listJobs } from "@/lib/jobs";
import type { ApplicationStatus } from "@/lib/types";
import ApplicationStatusControl from "./application-status-control";

export const dynamic = "force-dynamic";
const applicationStatus = new Set<ApplicationStatus>(["NOT_APPLIED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "REJECTED", "OFFER", "WITHDRAWN"]);

export default function ApplicationsPage() {
  const jobs = listJobs()
    .filter((job) => applicationStatus.has(job.application_status) && (job.application_status !== "NOT_APPLIED" || isReadyToApply(job)))
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

  return <main className="applications-page">
    <section className="page-intro"><div><h2>Application progress</h2><p>Record progress after you submit an application on the employer’s website.</p></div><span>{jobs.length} {jobs.length === 1 ? "record" : "records"}</span></section>
    {jobs.length ? <div className="job-table-scroll"><table className="data-table applications-table"><thead><tr><th>Role</th><th>Score</th><th>Application status</th><th>Updated</th><th>Open</th></tr></thead><tbody>
      {jobs.map((job) => <tr key={job.job_id}><td><Link className="table-role" href={`/jobs/${job.job_id}`}><span>{job.title}</span><small>{job.company} · {job.job_id}</small></Link></td><td>{evaluationLabel(job)}</td><td><ApplicationStatusControl jobId={job.job_id} initialStatus={job.application_status as ApplicationStatus} /></td><td>{job.updated_at ? new Date(job.updated_at).toLocaleDateString() : "—"}</td><td><Link href={`/jobs/${job.job_id}`}>Open →</Link></td></tr>)}
    </tbody></table></div> : <p className="table-empty">No applications are ready to track yet. Prepare a role in Jobs to move it into this list.</p>}
    <p className="application-safety">Applications are submitted manually on employer websites. This tracker only records the status you choose.</p>
  </main>;
}
