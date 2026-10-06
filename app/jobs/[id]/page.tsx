import Link from "next/link";
import { notFound } from "next/navigation";
import CopyCodexPrompt from "./copy-codex-prompt";
import CopySourceDetails from "./copy-source-details";
import { codexPrompt, evaluationLabel, isLowFitEvaluation, jobNextStep, materialActionLabel } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { readUsableJobAnalysis, type CandidateFactRef, type JobAnalysis } from "@/lib/agent-workflow";
import { getJob } from "@/lib/jobs";
import { materialArtifacts } from "@/lib/materials";
import { loadFactualProfile, type FactualProfile } from "@/lib/profile";
import { isReadyToApply } from "@/lib/core/job-workflow";

export const dynamic = "force-dynamic";

const pretty = (value: string) => value.replaceAll("_", " ");

function ReviewActions({ job }: { job: any }) {
  return <div className="detail-action-row"><form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="INTERESTED" /><button>Mark Interested</button></form><form action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="SKIPPED" /><button className="secondary">Skip</button></form></div>;
}

function TrackingControl({ job }: { job: any }) {
  return <form className="detail-tracking-control" action={`/api/jobs/${job.job_id}/application`} method="post"><label>Application status<select name="status" defaultValue={job.application_status}>{["NOT_APPLIED", "READY_TO_APPLY", "APPLIED", "INTERVIEW", "REJECTED", "OFFER", "WITHDRAWN"].map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label><button className="secondary">Save status</button></form>;
}

function FactReference({ reference, profile }: { reference: CandidateFactRef; profile?: FactualProfile }) {
  let value: string | undefined;
  if (profile) {
    if (reference.kind === "skill") value = profile.skills?.[reference.index!];
    else if (reference.kind === "experience") { const item = profile.experience?.[reference.index!]; value = item ? `${item.title} · ${item.employer}` : undefined; }
    else if (reference.kind === "experienceBullet") value = profile.experience?.[reference.index!]?.bullets?.[reference.bulletIndex!];
    else if (reference.kind === "summary") value = profile.summary;
    else if (reference.kind === "education") value = profile.education?.[reference.index!];
    else if (reference.kind === "language") value = profile.languages?.[reference.index!];
  }
  return <span>{value || "Validated profile reference"}</span>;
}

function EvidenceList({ items, empty }: { items: Array<{ text: string; evidence: string }>; empty: string }) {
  if (!items.length) return <p className="detail-muted">{empty}</p>;
  return <ul className="analysis-reading-list">{items.map((item, index) => <li key={`${item.text}-${index}`}><strong>{item.text}</strong><small>JD evidence: {item.evidence}</small></li>)}</ul>;
}

function JobInformation({ job }: { job: any }) {
  return <dl className="detail-definition-list"><div><dt>Company</dt><dd>{job.company}</dd></div><div><dt>Location</dt><dd>{job.location || "Not stated"}</dd></div><div><dt>Work model</dt><dd>{job.work_model || "Not stated"}</dd></div><div><dt>Canonical source</dt><dd>{job.canonical_source || "Not recorded"}</dd></div><div><dt>ATS</dt><dd>{job.ats || "Unknown"}</dd></div><div><dt>Posted</dt><dd>{job.posted_at || "Not recorded"}</dd></div><div><dt>Found</dt><dd>{job.found_at || "Not recorded"}</dd></div></dl>;
}

function AnalysisReport({ analysis, profile, score }: { analysis: JobAnalysis; profile?: FactualProfile; score: string }) {
  const matches = new Map(analysis.matches.map((match) => [match.requirement, match]));
  const interpretation = (value?: { text: string; evidence: string }) => value ? <><strong>{value.text}</strong><small>JD evidence: {value.evidence}</small></> : <span className="detail-muted">Not recorded</span>;
  const topicLabel = (topic: string) => ({ employmentType: "Employment type", workModel: "Work model", probationOrNotice: "Probation or notice", collectiveAgreement: "Collective agreement", thirteenthSalary: "13th salary", applicationDocuments: "Application documents" } as Record<string, string>)[topic] || topic;

  return <div className="analysis-reading">
    <section className="analysis-section"><h2>Role analysis</h2><dl className="detail-definition-list"><div><dt>Archetype</dt><dd>{analysis.role.archetype}</dd></div><div><dt>Seniority</dt><dd>{interpretation(analysis.role.seniority)}</dd></div><div><dt>Work model</dt><dd>{interpretation(analysis.role.workModel)}</dd></div><div><dt>Location</dt><dd>{interpretation(analysis.role.location)}</dd></div><div><dt>Evaluation</dt><dd>{score}</dd></div></dl></section>

    <section className="analysis-section"><h2>Requirements &amp; candidate match</h2>{analysis.requirements.length ? <ol className="requirements-list">{analysis.requirements.map((requirement, index) => {
      const match = matches.get(requirement.text);
      const matched = Boolean(match?.candidateFactRefs.length);
      const status = matched ? "Matched" : match ? "Gap / not supported" : "No match recorded";
      return <li key={`${requirement.text}-${index}`}><div className="requirement-title"><strong>{requirement.text}</strong><span className={matched ? "match-supported" : "match-unresolved"}>{status}</span></div><small>JD evidence: {requirement.evidence}</small>{match?.candidateFactRefs.length ? <ul className="fact-reference-list">{match.candidateFactRefs.map((reference, refIndex) => <li key={`${reference.kind}-${reference.index}-${reference.bulletIndex}-${refIndex}`}><FactReference reference={reference} profile={profile} /></li>)}</ul> : null}</li>;
    })}</ol> : <p className="detail-muted">No requirements recorded.</p>}
      <h3>Strengths</h3>{analysis.strengths.length ? <ul className="compact-reference-list">{analysis.strengths.map((reference, index) => <li key={`${reference.kind}-${reference.index}-${reference.bulletIndex}-${index}`}><FactReference reference={reference} profile={profile} /></li>)}</ul> : <p className="detail-muted">No strengths recorded.</p>}
    </section>

    <section className="analysis-section"><h2>Gaps</h2><EvidenceList items={analysis.gaps} empty="No documented gaps." /></section>
    <section className="analysis-section"><h2>Germany / DACH considerations</h2>{analysis.germanyDachConsiderations.length ? <ul className="analysis-reading-list">{analysis.germanyDachConsiderations.map((item, index) => <li key={`${item.topic}-${index}`}><strong>{topicLabel(item.topic)}</strong><small>JD evidence: {item.evidence}</small></li>)}</ul> : <p className="detail-muted">None recorded.</p>}</section>
    <section className="analysis-section"><h2>Keywords</h2>{analysis.keywords.length ? <ul className="keyword-list">{analysis.keywords.map((item, index) => <li key={`${item.text}-${index}`}><strong>{item.text}</strong><span>Priority {item.priority}</span></li>)}</ul> : <p className="detail-muted">None recorded.</p>}</section>
    <section className="analysis-section"><h2>Tailoring plan</h2>{analysis.tailoringPlan.skillIndexes.length || analysis.tailoringPlan.experiences.length || analysis.tailoringPlan.keywords.length ? <div className="tailoring-reading"><div><h3>Selected skills</h3>{analysis.tailoringPlan.skillIndexes.length ? <ul className="compact-reference-list">{analysis.tailoringPlan.skillIndexes.map((index) => <li key={index}><FactReference reference={{ kind: "skill", index }} profile={profile} /></li>)}</ul> : <p className="detail-muted">None selected.</p>}</div><div><h3>Selected experience</h3>{analysis.tailoringPlan.experiences.length ? <ul className="compact-reference-list">{analysis.tailoringPlan.experiences.map(({ index, bulletIndexes }) => <li key={index}><FactReference reference={{ kind: "experience", index }} profile={profile} />{bulletIndexes.length > 0 && <ul>{bulletIndexes.map((bulletIndex) => <li key={bulletIndex}><FactReference reference={{ kind: "experienceBullet", index, bulletIndex }} profile={profile} /></li>)}</ul>}</li>)}</ul> : <p className="detail-muted">None selected.</p>}</div><div><h3>Selected keywords</h3><p>{analysis.tailoringPlan.keywords.join(", ") || "None selected."}</p></div></div> : <p className="detail-muted">No tailoring references were selected.</p>}</section>
  </div>;
}

export default async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) notFound();
  const sources = db().prepare("SELECT * FROM job_sources WHERE job_id=?").all(job.id) as any[];
  const artifacts = materialArtifacts(job);
  const analysis = readUsableJobAnalysis(job.job_id);
  const profile = analysis ? (() => { try { return loadFactualProfile(); } catch { return undefined; } })() : undefined;
  const score = evaluationLabel(analysis ? job : { ...job, analysis_json: null });
  const next = jobNextStep(job, Boolean(analysis));
  const materialAction = ["History", "Active"].includes(next.stage) ? undefined : materialActionLabel(job, analysis);
  const prompt = codexPrompt(job.job_id);
  const canTrack = ["APPLIED", "INTERVIEW", "OFFER"].includes(job.application_status) || isReadyToApply(job);
  const analysisStatus = analysis ? "Validated" : job.content_status === "INSUFFICIENT" ? "Blocked by source" : job.review_status === "PENDING" ? "After review" : "Not analyzed";
  const capturedDescription = job.jd_original ?? "";
  const sourceMetadata = { canonicalSource: job.canonical_source ?? "", ats: job.ats || "Unknown", content: job.content_status || "SUBSTANTIVE", posted: job.posted_at || "Not recorded", found: job.found_at ?? "Not recorded" };
  const sourceDetailsText = `${capturedDescription}\n\nCanonical source: ${sourceMetadata.canonicalSource}\nATS: ${sourceMetadata.ats}\nSource content: ${sourceMetadata.content}\nPosted: ${sourceMetadata.posted}\nFound: ${sourceMetadata.found}`;

  return <main className="job-detail-page">
    <Link className="back" href="/jobs">← Back to Jobs</Link>
    <section className="job-detail-heading"><div><p className="eyebrow">{job.job_id} · {next.stage.toUpperCase()}</p><h2>{job.title}</h2><p>{job.company} <span>·</span> {job.location || "Location not stated"} <span>·</span> {job.work_model || "Work model not stated"}</p></div><div className="job-detail-evaluation"><span>Evaluation</span><strong>{score}</strong></div></section>

    <section className="detail-status-strip" aria-label="Job status"><div><small>Review</small><strong>{pretty(job.review_status)}</strong></div><div><small>Analysis</small><strong>{analysisStatus}</strong></div><div><small>Materials</small><strong>{pretty(job.material_status)}</strong></div><div><small>Application</small><strong>{pretty(job.application_status)}</strong></div></section>

    <div className="job-detail-layout">
      <div className="job-detail-main">
        {analysis ? <AnalysisReport analysis={analysis} profile={profile} score={score} /> : <div className="analysis-reading pre-analysis-reading">
          <section className="analysis-section"><h2>Job information</h2><JobInformation job={job} /></section>
          <section className="analysis-section"><h2>Current state</h2><p>{next.description}</p><p className="detail-muted">Validated analysis is not available for this job yet. Analysis sections appear here only after a validated result is stored.</p></section>
        </div>}
        <details className="source-details job-description-details"><summary>Captured JD and source evidence</summary><CopySourceDetails text={sourceDetailsText} /><article>{capturedDescription || "No captured job description is stored."}</article><dl><dt>Canonical source</dt><dd>{sourceMetadata.canonicalSource || "Not recorded"}</dd><dt>ATS</dt><dd>{sourceMetadata.ats}</dd><dt>Source content</dt><dd>{pretty(sourceMetadata.content)}</dd><dt>Posted</dt><dd>{sourceMetadata.posted}</dd><dt>Found</dt><dd>{sourceMetadata.found}</dd></dl></details>
      </div>

      <aside className="job-detail-sidebar">
        <section className="detail-module" id="workflow-panel"><h2>Workflow</h2><p className="detail-module-stage">{next.stage}</p><h3>{next.title}</h3><p>{next.description}</p>{next.action === "review" && <ReviewActions job={job} />}{next.action === "source" && <a className="detail-text-link" href="#source-panel">Open source details ↓</a>}{next.action === "analyze" && <a className="detail-text-link" href="#codex-panel">Go to Codex prompt ↓</a>}{job.review_status === "INTERESTED" && !["History", "Active"].includes(next.stage) && <form className="detail-skip-form" action={`/api/jobs/${job.job_id}/review`} method="post"><input type="hidden" name="status" value="SKIPPED" /><button className="secondary">Skip this job</button></form>}</section>

        <section className="detail-module" id="application-panel"><h2>Application tracking</h2><p className="detail-module-value">{pretty(job.application_status)}</p><p className="detail-muted">Record the status after you apply on the employer’s site. This app never submits applications.</p>{canTrack ? <TrackingControl job={job} /> : <p className="detail-muted">Status tracking becomes available when the application is ready or has been submitted.</p>}</section>

        <section className="detail-module" id="materials-panel"><h2>Materials</h2><p className="detail-module-value">{pretty(job.material_status)}</p>{isLowFitEvaluation(job) && analysis && materialAction && <p className="detail-caution">Low fit ({score}). Review the documented gaps before generating materials.</p>}{materialAction ? <form action={`/api/jobs/${job.job_id}/generate`} method="post"><button>{job.material_status === "ERROR" ? "Retry Materials" : isLowFitEvaluation(job) && job.material_status !== "READY" ? "Generate Materials Anyway" : materialAction}</button></form> : <p className="detail-muted">{job.content_status === "INSUFFICIENT" ? "Materials are unavailable because the captured source content is insufficient." : job.review_status !== "INTERESTED" ? "Mark this job Interested before preparing materials." : !analysis ? "Validated analysis is required before materials can be generated." : "Materials are not available for the current workflow state."}</p>}{artifacts.length > 0 ? <div className="artifact-list">{artifacts.map((artifact) => <a className="detail-artifact-link" key={artifact.key} href={`/api/jobs/${job.job_id}/materials/${artifact.key}`} target="_blank" rel="noreferrer">{artifact.label}</a>)}</div> : <p className="detail-muted">No generated files are stored yet.</p>}</section>

        <section className="detail-module" id="codex-panel"><h2>Codex</h2>{analysis ? <><p className="detail-module-value">Validated analysis available</p><p className="detail-muted">The stored result passed the job and factual profile validation.</p></> : next.action === "analyze" ? <><p>Use the job-agent workflow with this permanent Job ID.</p><code className="codex-prompt">{prompt}</code><CopyCodexPrompt prompt={prompt} /></> : job.content_status === "INSUFFICIENT" ? <p className="detail-muted">Codex analysis is unavailable until the source contains enough job-description evidence.</p> : job.review_status === "PENDING" ? <p className="detail-muted">Make a Review decision before requesting Codex analysis.</p> : <p className="detail-muted">Codex analysis is not the current next step.</p>}</section>

        <section className="detail-module" id="source-panel"><h2>Source</h2><dl className="detail-source-list"><div><dt>Canonical source</dt><dd>{sourceMetadata.canonicalSource || "Not recorded"}</dd></div><div><dt>ATS</dt><dd>{sourceMetadata.ats}</dd></div><div><dt>Content</dt><dd>{pretty(sourceMetadata.content)}</dd></div><div><dt>Posted</dt><dd>{sourceMetadata.posted}</dd></div><div><dt>Found</dt><dd>{sourceMetadata.found}</dd></div></dl>{job.canonical_url && <a className="detail-text-link" href={job.canonical_url} target="_blank" rel="noreferrer">Open employer posting ↗</a>}{sources.length > 0 && <div className="detail-source-links"><h3>Additional sources</h3>{sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.source_name}</a>)}</div>}</section>
      </aside>
    </div>
    <p className="detail-safety-note">Submit applications manually on the employer’s website. Job Search Agent records application status but never submits an application.</p>
  </main>;
}
