import { canonicalEvaluationScore, evaluationLabel } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { getJob } from "@/lib/jobs";
import { materialArtifacts } from "@/lib/materials";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function analysisFor(job: any) {
  if (canonicalEvaluationScore(job) === undefined) return undefined;
  try { const analysis = JSON.parse(job.analysis_json); return analysis && typeof analysis === "object" ? analysis : undefined; } catch { return undefined; }
}

function stageFor(job: any) {
  if (job.review_status === "SKIPPED" || ["REJECTED", "WITHDRAWN"].includes(job.application_status)) return "History";
  if (["APPLIED", "INTERVIEW", "OFFER"].includes(job.application_status)) return "Active application";
  if (job.review_status === "PENDING") return "Review";
  return job.material_status === "READY" ? "Apply" : "Tailor";
}

const badge = (value: string) => <span className="badge">{value.replaceAll("_", " ")}</span>;

export default async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, job = getJob(id);
  if (!job) notFound();
  const sources = db().prepare("SELECT * FROM job_sources WHERE job_id=?").all(job.id) as any[], artifacts = materialArtifacts(job), insufficient = job.content_status === "INSUFFICIENT", ready = !insufficient && job.review_status === "INTERESTED" && job.material_status === "READY", analysis = analysisFor(job);
  return <main>
    <Link className="back" href="/">← Dashboard</Link>
    <section className="detail-head"><div><p className="eyebrow">{job.job_id} · {stageFor(job)}</p><h1>{job.title}</h1><p className="muted">{job.company} · {job.location || "Location not stated"} · {job.work_model || "Work model not stated"}</p></div><div className="score"><b>{evaluationLabel(job)}</b><span>canonical evaluation</span></div></section>
    <section className="status-grid" aria-label="Job status"><div><small>Workflow stage</small><b>{stageFor(job)}</b></div><div><small>Review</small>{badge(job.review_status)}</div><div><small>Materials</small>{badge(job.material_status)}</div><div><small>Application</small>{badge(job.application_status)}</div></section>
    <section className="workflow"><b>Search → Review → Tailor → Apply</b><span>{job.review_status === "PENDING" ? "Review this new job before preparing materials." : insufficient ? "Source content is insufficient for analysis or materials; this job remains visible for review." : ready ? "Materials are ready. You choose whether and when to record an application state." : "Continue with factual analysis and materials before any application decision."}</span></section>
    <section className="actions"><a className="button" href={job.canonical_url} target="_blank" rel="noreferrer">Open official source</a>{job.review_status !== "INTERESTED" && <form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="INTERESTED" /><button>Mark Interested</button></form>}{job.review_status !== "SKIPPED" && <form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="SKIPPED" /><button className="secondary">Skip</button></form>}{job.review_status === "INTERESTED" && !insufficient && <form action={`/api/jobs/${job.job_id}/generate`} method="post"><button>{job.material_status === "READY" ? "Regenerate materials" : "Generate materials"}</button></form>}{ready && <form action={`/api/jobs/${job.job_id}/application`} method="post"><select name="status" defaultValue={job.application_status}>{["NOT_APPLIED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "REJECTED", "OFFER", "WITHDRAWN"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><button className="secondary">Save manual application status</button></form>}</section>
    <div className="detail-grid"><section><p className="eyebrow">EVALUATION</p><h2>Analysis workspace</h2>{analysis ? <div className="analysis-grid"><div><small>Role / archetype</small><b>{analysis.role?.archetype || "Not stated"}</b></div><div><small>Evaluation</small><b>{evaluationLabel(job)}</b></div><div className="analysis-wide"><small>Requirements</small><ul>{(Array.isArray(analysis.requirements) ? analysis.requirements : []).map((item: any, index: number) => <li key={index}>{item.text}</li>)}</ul></div><div className="analysis-wide"><small>Gaps</small>{Array.isArray(analysis.gaps) && analysis.gaps.length ? <ul>{analysis.gaps.map((item: any, index: number) => <li key={index}>{item.text}</li>)}</ul> : <p className="muted">No documented gaps.</p>}</div><div className="analysis-wide"><small>Germany / DACH considerations</small>{Array.isArray(analysis.germanyDachConsiderations) && analysis.germanyDachConsiderations.length ? <ul>{analysis.germanyDachConsiderations.map((item: any, index: number) => <li key={index}><b>{item.topic}:</b> {item.evidence}</li>)}</ul> : <p className="muted">None recorded.</p>}</div><div className="analysis-wide"><small>Keywords</small><p>{(Array.isArray(analysis.keywords) ? analysis.keywords : []).map((item: any) => item.text).join(", ") || "None recorded."}</p></div><div className="analysis-wide"><small>Match summary</small><p>{Array.isArray(analysis.matches) && analysis.matches.length ? `${analysis.matches.length} documented requirement match${analysis.matches.length === 1 ? "" : "es"}.` : "No documented matches."}</p></div></div> : <div className="empty"><b>Not analyzed</b><span>A valid canonical 1–5 analysis has not been stored for this job.</span></div>}<details className="source-details"><summary>Captured job description and source metadata</summary><article>{job.jd_original}</article><dl><dt>Canonical source</dt><dd>{job.canonical_source}</dd><dt>ATS</dt><dd>{job.ats || "Unknown / safe default"}</dd><dt>Source content</dt><dd>{job.content_status || "SUBSTANTIVE"}</dd><dt>Posted</dt><dd>{job.posted_at || "Unknown"}</dd><dt>Found</dt><dd>{job.found_at}</dd></dl></details></section><aside><p className="eyebrow">ARTIFACTS</p><h2>Generated materials</h2>{artifacts.length ? <><p className="muted">Opening an artifact never regenerates it or changes status.</p><div className="artifact-list">{artifacts.map((artifact) => <a className="secondary" key={artifact.key} href={`/api/jobs/${job.job_id}/materials/${artifact.key}`} target="_blank" rel="noreferrer">{artifact.label}</a>)}</div></> : <p className="muted">No generated materials are stored yet.</p>}<h2>All sources</h2>{sources.length ? sources.map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.source_name}</a></p>) : <p className="muted">No additional sources.</p>}</aside></div>
    <p className="safety">No action on this page submits an application.</p>
  </main>;
}
