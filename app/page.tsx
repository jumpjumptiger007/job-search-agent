import { readUsableJobAnalysis } from "@/lib/agent-workflow";
import { dashboardWorkflow, overviewCounts } from "@/lib/dashboard";
import { listJobs } from "@/lib/jobs";
import { DiscoveryActions, DiscoveryForm } from "./discovery-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const workGroups = [
  { key: "review", title: "Review", description: (count: number) => `${count} ${count === 1 ? "job needs" : "jobs need"} a decision`, href: "/jobs?filter=review" },
  { key: "analyze", title: "Analyze", description: (count: number) => `${count} ${count === 1 ? "job needs" : "jobs need"} validated Codex analysis`, href: "/jobs?filter=analyze" },
  { key: "materials", title: "Materials", description: (count: number) => `${count} ${count === 1 ? "job needs" : "jobs need"} materials prepared`, href: "/jobs?filter=materials" },
  { key: "ready", title: "Apply", description: (count: number) => `${count} ${count === 1 ? "application is" : "applications are"} ready`, href: "/applications?filter=ready" },
] as const;

export default function Overview() {
  const jobs = listJobs();
  const usableJobIds = new Set(jobs.filter((job) => Boolean(readUsableJobAnalysis(job.job_id))).map((job) => job.job_id));
  const queues = dashboardWorkflow(jobs, (job) => usableJobIds.has(job.job_id));
  const counts = overviewCounts(queues);
  const total = jobs.length;
  const priorityGroups = workGroups.filter(({ key }) => counts[key] > 0);

  return <DiscoveryActions><main className="overview-page">
    <section className="overview-heading"><div><h2>Current workload and anything that needs action.</h2><p>{counts.attention} {counts.attention === 1 ? "item needs" : "items need"} attention</p></div><DiscoveryForm source="overview" /></section>
    <p className="overview-breakdown">{[["review", "review"], ["analyze", "analyze"], ["materials", "materials"], ["ready", "ready to apply"]].filter(([key]) => counts[key as keyof typeof counts] > 0).map(([key, label]) => `${counts[key as keyof typeof counts]} ${label}`).join(" · ") || "No active work needs attention"}</p>

    <section className="overview-status" aria-label="Current workload by stage">
      {[["Review", counts.review, "/jobs?filter=review"], ["Analyze", counts.analyze, "/jobs?filter=analyze"], ["Materials", counts.materials, "/jobs?filter=materials"], ["Ready", counts.ready, "/applications?filter=ready"], ["Active", counts.active, "/applications"]].map(([label, count, href]) => <Link className="overview-status-item" href={String(href)} key={String(label)}><span>{label}</span><strong>{count}</strong></Link>)}
    </section>

    <div className="overview-columns">
      <section className="overview-priority"><div className="overview-section-title"><h3>Priority</h3><Link href="/jobs">All jobs</Link></div>
        {priorityGroups.length ? <div>{priorityGroups.map((group) => <Link className="priority-row" href={group.href} key={group.key}><strong>{counts[group.key]}</strong><span><b>{group.title}</b><small>{group.description(counts[group.key])}</small></span><span className="priority-open">Open →</span></Link>)}</div> : <p className="overview-empty">No items need action right now.</p>}
      </section>
      <aside className="overview-snapshot"><h3>Snapshot</h3><dl><div><dt>Jobs</dt><dd>{total}</dd></div><div><dt>New jobs</dt><dd>{queues.review.length}</dd></div><div><dt>Applied</dt><dd>{jobs.filter((job) => job.application_status === "APPLIED").length}</dd></div><div><dt>Interview</dt><dd>{jobs.filter((job) => job.application_status === "INTERVIEW").length}</dd></div><div><dt>Offer</dt><dd>{jobs.filter((job) => job.application_status === "OFFER").length}</dd></div></dl></aside>
    </div>
  </main></DiscoveryActions>;
}
