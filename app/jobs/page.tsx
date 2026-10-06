import { readUsableJobAnalysis } from "@/lib/agent-workflow";
import { dashboardWorkflow, jobsForQueue, searchJobs, type JobsQueueFilter } from "@/lib/dashboard";
import { listJobs } from "@/lib/jobs";
import JobsTable from "./jobs-table";

export const dynamic = "force-dynamic";
const filters: JobsQueueFilter[] = ["all", "review", "analyze", "materials", "ready"];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
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
  const rows = searchJobs(jobsForQueue(queues, filter), query).map((job) => ({ ...job, has_usable_analysis: usableIds.has(job.job_id) }));

  return <main className="jobs-page">
    <section className="page-intro"><div><h2>Active work queue</h2><p>Search and maintain review decisions. Application progress stays on Applications.</p></div><span>{rows.length} {rows.length === 1 ? "job" : "jobs"}</span></section>
    <JobsTable jobs={rows} filter={filter} query={query} counts={counts} />
  </main>;
}
