import { readUsableJobAnalysis } from "@/lib/agent-workflow";
import { dashboardWorkflow, jobsForQueue, searchJobs, type JobsQueueFilter } from "@/lib/dashboard";
import { listJobs } from "@/lib/jobs";
import JobsTable from "./jobs-table";
import { paginateJobs } from "./pagination";

export const dynamic = "force-dynamic";
const filters: JobsQueueFilter[] = ["all", "review", "analyze", "materials", "ready"];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const params = await searchParams;
  const filter = filters.includes(params.filter as JobsQueueFilter) ? params.filter as JobsQueueFilter : "all";
  const query = typeof params.q === "string" ? params.q : "";
  const sourceJobs = listJobs();
  const usableIds = new Set(sourceJobs.filter((job) => Boolean(readUsableJobAnalysis(job.job_id))).map((job) => job.job_id));
  const queues = dashboardWorkflow(sourceJobs, (job) => usableIds.has(job.job_id));
  const counts = {
    all: queues.review.length + queues.analyze.length + queues.materials.length + queues.apply.length + queues.active.length,
    review: queues.review.length,
    analyze: queues.analyze.length,
    materials: queues.materials.length,
    ready: queues.apply.length,
  };
  const filteredRows = searchJobs(jobsForQueue(queues, filter), query).map((job) => ({ ...job, has_usable_analysis: usableIds.has(job.job_id) }));
  const pagination = paginateJobs(filteredRows, params.page);

  return <main id="main-content" tabIndex={-1} className="jobs-page">
    <section className="page-intro"><div><h2>Active work queue</h2><p>Search and maintain review decisions. Application progress stays on Applications.</p></div><span>{pagination.total} {pagination.total === 1 ? "job" : "jobs"}</span></section>
    <JobsTable key={`${filter}:${query}:${pagination.page}`} jobs={pagination.rows} filter={filter} query={query} counts={counts} page={pagination.page} pageCount={pagination.pageCount} />
  </main>;
}
