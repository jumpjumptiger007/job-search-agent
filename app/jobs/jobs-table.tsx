"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { evaluationLabel, jobNextStep } from "@/lib/dashboard";
import { saveReviewStatus, saveReviewStatuses } from "@/lib/review-actions";
import { jobsPageHref } from "./pagination";
import { currentPageSelection, setCurrentPageSelection } from "./selection";

type JobRow = Record<string, any>;
type ReviewStatus = "INTERESTED" | "SKIPPED";

export default function JobsTable({ jobs, filter, query, counts, page, pageCount }: { jobs: JobRow[]; filter: string; query: string; counts: Record<string, number>; page: number; pageCount: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const reviewableJobs = jobs.filter((job) => ["NOT_APPLIED", "READY_TO_APPLY"].includes(job.application_status));
  const reviewableIds = reviewableJobs.map((job) => job.job_id);
  const selectedOnPage = currentPageSelection(selected, reviewableIds);

  const toggle = (jobId: string, checked: boolean) => setSelected((current) => {
    const visible = currentPageSelection(current, reviewableIds);
    return checked ? [...new Set([...visible, jobId])] : visible.filter((id) => id !== jobId);
  });
  const selectVisible = (checked: boolean) => setSelected((current) => setCurrentPageSelection(current, reviewableIds, checked));

  async function updateOne(jobId: string, status: ReviewStatus) {
    setBusy(true);
    setFeedback(null);
    try {
      await saveReviewStatus(jobId, status);
      setSelected((current) => current.filter((id) => id !== jobId));
      router.refresh();
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Review status could not be updated.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function updateSelected(status: ReviewStatus) {
    const selectedForPage = currentPageSelection(selected, reviewableIds);
    if (!selectedForPage.length || busy) return;
    setBusy(true);
    setFeedback(null);
    const results = await saveReviewStatuses(selectedForPage, status);
    const failed = results.failed;
    const succeeded = results.succeeded.length;
    setSelected(failed.map((result) => result.jobId));
    setFeedback(failed.length
      ? { message: `${succeeded} updated; ${failed.length} failed. ${failed[0].message}`, error: true }
      : { message: `${succeeded} jobs updated.`, error: false });
    setBusy(false);
    router.refresh();
  }

  return <>
    <div className="jobs-toolbar">
      <nav className="queue-filters" aria-label="Filter jobs">
        {[["all", "All active"], ["review", "Review"], ["analyze", "Analyze"], ["materials", "Materials"], ["ready", "Ready"]].map(([key, label]) => <Link key={key} className={`queue-filter${filter === key ? " is-active" : ""}`} aria-current={filter === key ? "page" : undefined} href={`/jobs?filter=${key}`}>
          {label}<span>{counts[key]}</span>
        </Link>)}
      </nav>
      <form className="jobs-search" action="/jobs" role="search"><input type="hidden" name="filter" value={filter} /><label htmlFor="job-search">Search jobs</label><input id="job-search" type="search" name="q" placeholder="Role, company, location or JOB ID" defaultValue={query} /><button className="secondary" type="submit">Search</button></form>
    </div>

    {pageCount > 1 && <nav className="jobs-pagination" aria-label="Jobs pagination">
      <span className="jobs-pagination-summary">Page {page} of {pageCount}</span>
      <div className="jobs-pagination-actions">
        {page > 1 && <Link href={jobsPageHref(filter, query, page - 1)}>Previous</Link>}
        {page < pageCount && <Link href={jobsPageHref(filter, query, page + 1)}>Next</Link>}
      </div>
    </nav>}

    {selectedOnPage.length > 0 && <section className="batch-toolbar" aria-label="Selected job actions">
      <span>{selectedOnPage.length} selected</span><button type="button" disabled={busy} onClick={() => void updateSelected("INTERESTED")}>Mark Interested</button><button className="secondary" type="button" disabled={busy} onClick={() => void updateSelected("SKIPPED")}>Skip</button><button className="text-button" type="button" disabled={busy} onClick={() => setSelected([])}>Clear selection</button>
    </section>}
    {feedback && <p className={`table-feedback${feedback.error ? " is-error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
    {jobs.length ? <div className="job-table-scroll"><table className="data-table jobs-table"><thead><tr><th><input type="checkbox" aria-label="Select reviewable jobs" disabled={!reviewableJobs.length} checked={reviewableJobs.length > 0 && reviewableJobs.every((job) => selectedOnPage.includes(job.job_id))} onChange={(event) => selectVisible(event.target.checked)} /></th><th>Role</th><th>Location</th><th>Score</th><th>Review</th><th>Materials</th><th>Application</th><th>Next</th></tr></thead><tbody>
      {jobs.map((job) => {
        const next = jobNextStep(job, Boolean(job.has_usable_analysis));
        return <tr key={job.job_id}>
          <td><input type="checkbox" aria-label={`Select ${job.job_id}`} disabled={!reviewableJobs.includes(job)} checked={selectedOnPage.includes(job.job_id)} onChange={(event) => toggle(job.job_id, event.target.checked)} /></td>
          <td><Link className="table-role" href={`/jobs/${job.job_id}`}><span>{job.title}</span><small>{job.company} · {job.job_id}</small></Link></td>
          <td>{[job.location, job.work_model].filter(Boolean).join(" · ") || "—"}</td>
          <td>{evaluationLabel(job)}</td>
          <td>{job.review_status !== "SKIPPED" ? <div className="row-actions"><span>{job.review_status.replaceAll("_", " ")}</span>{reviewableJobs.includes(job) && job.review_status === "PENDING" && <button type="button" disabled={busy} onClick={() => void updateOne(job.job_id, "INTERESTED")}>Interested</button>}{reviewableJobs.includes(job) && <button className="text-button" type="button" disabled={busy} onClick={() => void updateOne(job.job_id, "SKIPPED")}>Skip</button>}</div> : "Skipped"}</td>
          <td>{job.material_status.replaceAll("_", " ")}</td>
          <td>{job.application_status.replaceAll("_", " ")}</td>
          <td><span className="next-label">{next.stage}</span><small className="next-description">{next.title}</small></td>
        </tr>;
      })}
    </tbody></table></div> : <p className="table-empty">No jobs match this view.</p>}
  </>;
}
