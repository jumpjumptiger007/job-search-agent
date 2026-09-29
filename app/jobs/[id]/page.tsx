import CopyCodexPrompt from "./copy-codex-prompt";
import CopySourceDetails from "./copy-source-details";
import { codexPrompt, evaluationLabel, isLowFitEvaluation, jobNextStep, materialActionLabel } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { readUsableJobAnalysis } from "@/lib/agent-workflow";
import { getJob } from "@/lib/jobs";
import { materialArtifacts } from "@/lib/materials";
import { isReadyToApply } from "@/lib/core/job-workflow";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const badge = (value: string) => <span className={`badge badge-${value.toLowerCase()}`}>{value.replaceAll("_", " ")}</span>;

function ReviewActions({ job }: { job: any }) {
  return <div className="button-row"><form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="INTERESTED" /><button>Mark Interested</button></form><form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="SKIPPED" /><button className="secondary">Skip</button></form></div>;
}

function TrackingControl({ job }: { job: any }) {
  return <form className="tracking-control" action={`/api/jobs/${job.job_id}/application`} method="post"><select name="status" defaultValue={job.application_status}>{["NOT_APPLIED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "REJECTED", "OFFER", "WITHDRAWN"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><button className="secondary">Save application status</button></form>;
}

export default async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, job = getJob(id);
  if (!job) notFound();
  const sources = db().prepare("SELECT * FROM job_sources WHERE job_id=?").all(job.id) as any[], artifacts = materialArtifacts(job), analysis = readUsableJobAnalysis(job.job_id), next = jobNextStep(job, Boolean(analysis)), materialAction = materialActionLabel(job, analysis), prompt = codexPrompt(job.job_id);
  const capturedDescription = job.jd_original ?? "";
  const sourceMetadata = {
    canonicalSource: job.canonical_source ?? "",
    ats: job.ats || "Unknown / safe default",
    content: job.content_status || "SUBSTANTIVE",
    posted: job.posted_at || "Unknown",
    found: job.found_at ?? "",
  };
  const sourceDetailsText = `${capturedDescription}\n\nCanonical source: ${sourceMetadata.canonicalSource}\nATS: ${sourceMetadata.ats}\nSource content: ${sourceMetadata.content}\nPosted: ${sourceMetadata.posted}\nFound: ${sourceMetadata.found}`;
  const canTrack = ["APPLIED", "INTERVIEW", "OFFER"].includes(job.application_status) || isReadyToApply(job);
  return <main>
    <Link className="back" href="/">← Dashboard</Link>
    <section className="detail-head"><div><p className="eyebrow">{job.job_id} · {next.stage.toUpperCase()}</p><h1>{job.title}</h1><p className="muted">{job.company} · {job.location || "Location not stated"} · {job.work_model || "Work model not stated"}</p></div><div className="score"><b>{evaluationLabel(job)}</b><span>canonical evaluation</span></div></section>
    <section className="status-grid" aria-label="Job status"><div><small>Evaluation</small><b>{evaluationLabel(job)}</b></div><div><small>Review</small>{badge(job.review_status)}</div><div><small>Materials</small>{badge(job.material_status)}</div><div><small>Application</small>{badge(job.application_status)}</div></section>
    <section className={`next-step next-step-${next.stage.toLowerCase()}`}><p className="eyebrow">NEXT STEP</p><h2>{next.title}</h2><p>{next.description}</p>{next.action === "review" && <ReviewActions job={job} />}{next.action === "source" && <a className="button" href={job.canonical_url} target="_blank" rel="noreferrer">Open job posting</a>}{next.action === "analyze" && <><code className="codex-prompt">{prompt}</code><CopyCodexPrompt prompt={prompt} /></>}{(next.action === "materials" || next.action === "retry-materials") && <form action={`/api/jobs/${job.job_id}/generate`} method="post"><button>{next.action === "retry-materials" ? "Retry Materials" : isLowFitEvaluation(job) ? "Generate Materials Anyway" : "Generate Materials"}</button></form>}{next.action === "apply" && <div className="button-row"><a className="button" href={job.canonical_url} target="_blank" rel="noreferrer">Open job posting</a><TrackingControl job={job} /></div>}{next.action === "track" && <TrackingControl job={job} />}</section>
    {(next.stage !== "Review" && next.stage !== "History" && next.stage !== "Active") && <section className="secondary-actions">{next.action !== "source" && next.action !== "apply" && <a className="secondary" href={job.canonical_url} target="_blank" rel="noreferrer">Open job posting</a>}{isReadyToApply(job) && next.action !== "apply" && <TrackingControl job={job} />}{job.review_status === "INTERESTED" && <form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="SKIPPED" /><button className="secondary">Skip</button></form>}{materialAction && next.action !== "materials" && next.action !== "retry-materials" && <form action={`/api/jobs/${job.job_id}/generate`} method="post"><button className="secondary">{materialAction}</button></form>}</section>}
    <div className="detail-grid"><section><p className="eyebrow">EVALUATION</p><h2>Analysis workspace</h2>{analysis ? <div className="analysis-grid"><div><small>Role / archetype</small><b>{analysis.role?.archetype || "Not stated"}</b></div><div><small>Evaluation</small><b>{evaluationLabel(job)}</b></div><div className="analysis-wide"><small>Requirements</small><ul>{(Array.isArray(analysis.requirements) ? analysis.requirements : []).map((item: any, index: number) => <li key={index}>{item.text}</li>)}</ul></div><div className="analysis-wide"><small>Gaps</small>{Array.isArray(analysis.gaps) && analysis.gaps.length ? <ul>{analysis.gaps.map((item: any, index: number) => <li key={index}>{item.text}</li>)}</ul> : <p className="muted">No documented gaps.</p>}</div><div className="analysis-wide"><small>Germany / DACH considerations</small>{Array.isArray(analysis.germanyDachConsiderations) && analysis.germanyDachConsiderations.length ? <ul>{analysis.germanyDachConsiderations.map((item: any, index: number) => <li key={index}><b>{item.topic}:</b> {item.evidence}</li>)}</ul> : <p className="muted">None recorded.</p>}</div><div className="analysis-wide"><small>Keywords</small><p>{(Array.isArray(analysis.keywords) ? analysis.keywords : []).map((item: any) => item.text).join(", ") || "None recorded."}</p></div></div> : <div className="empty"><b>Not analyzed</b><span>A valid canonical 1–5 analysis has not been stored for this job.</span></div>}<details className="source-details"><summary>Captured job description and source metadata</summary><CopySourceDetails text={sourceDetailsText} /><article>{capturedDescription}</article><dl><dt>Canonical source</dt><dd>{sourceMetadata.canonicalSource}</dd><dt>ATS</dt><dd>{sourceMetadata.ats}</dd><dt>Source content</dt><dd>{sourceMetadata.content}</dd><dt>Posted</dt><dd>{sourceMetadata.posted}</dd><dt>Found</dt><dd>{sourceMetadata.found}</dd></dl></details></section><aside><p className="eyebrow">ARTIFACTS</p><h2>Generated materials</h2>{artifacts.length ? <><p className="muted">Opening an artifact never regenerates it or changes status.</p><div className="artifact-list">{artifacts.map((artifact) => <a className="secondary" key={artifact.key} href={`/api/jobs/${job.job_id}/materials/${artifact.key}`} target="_blank" rel="noreferrer">{artifact.label}</a>)}</div></> : <p className="muted">No generated materials are stored yet.</p>}<h2>All sources</h2>{sources.length ? sources.map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.source_name}</a></p>) : <p className="muted">No additional sources.</p>}</aside></div>
    {canTrack || next.stage === "Apply" ? <p className="safety">Submit the application on the employer&apos;s website. Job Search Agent never submits applications automatically.</p> : <p className="safety">No action on this page submits an application.</p>}
  </main>;
}
