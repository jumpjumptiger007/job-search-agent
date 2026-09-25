import { db } from "./db";
import { loadCareerOpsMode } from "./integrations/career-ops";
import { getJob } from "./jobs";
import { loadFactualProfile, type FactualProfile } from "./profile";

export const JOB_ANALYSIS_SCHEMA_VERSION = "v0.7";
export type CandidateFactRef = { kind: "skill" | "experience" | "experienceBullet" | "summary" | "education" | "language"; index?: number; bulletIndex?: number };
export type Evidence = { text: string; evidence: string };
export type TailoringPlan = { skillIndexes: number[]; experiences: { index: number; bulletIndexes: number[] }[]; keywords: string[] };
export type JobAnalysis = {
  schemaVersion: typeof JOB_ANALYSIS_SCHEMA_VERSION;
  jobId: string;
  role: { archetype: string; seniority?: Evidence; workModel?: Evidence; location?: Evidence };
  requirements: Evidence[];
  matches: { requirement: string; candidateFactRefs: CandidateFactRef[] }[];
  gaps: Evidence[];
  germanyDachConsiderations: { topic: "language" | "employmentType" | "workModel" | "location" | "probationOrNotice" | "collectiveAgreement" | "thirteenthSalary" | "vwl" | "bav" | "applicationDocuments"; evidence: string }[];
  strengths: CandidateFactRef[];
  keywords: { text: string; priority: number; evidence: string }[];
  tailoringPlan: TailoringPlan;
  evaluation: { score: number };
  provenance: { candidateSource: "profile/profile.yaml"; approvedFactRefs: CandidateFactRef[] };
  unsupportedClaims: string[];
};

const policyPaths = ["_shared.md", "oferta.md", "_writing.md", "de/_shared.md", "de/angebot.md"] as const;
const record = (value: unknown, name: string): Record<string, any> => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid job analysis: ${name}`); return value as Record<string, any>; };
const text = (value: unknown, name: string) => { if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid job analysis: ${name}`); return value; };
const list = (value: unknown, name: string) => { if (!Array.isArray(value)) throw new Error(`Invalid job analysis: ${name}`); return value; };
const jdIncludes = (jd: string, value: unknown, name: string) => { const evidence = text(value, name); if (!jd.toLocaleLowerCase().includes(evidence.toLocaleLowerCase())) throw new Error(`Invalid job analysis: ${name} is not evidenced by the canonical JD`); return evidence; };
const sameRef = (left: CandidateFactRef, right: CandidateFactRef) => left.kind === right.kind && left.index === right.index && left.bulletIndex === right.bulletIndex;

function validateFactRef(value: unknown, profile: FactualProfile): CandidateFactRef {
  const ref = record(value, "candidate fact reference") as CandidateFactRef;
  if (!["skill", "experience", "experienceBullet", "summary", "education", "language"].includes(ref.kind)) throw new Error("Invalid job analysis: unknown candidate fact reference");
  const index = ref.index;
  if (ref.kind === "summary") { if (profile.summary === undefined || index !== undefined || ref.bulletIndex !== undefined) throw new Error("Invalid job analysis: unsupported candidate fact reference"); return { kind: "summary" }; }
  if (!Number.isInteger(index) || index! < 0) throw new Error("Invalid job analysis: invalid candidate fact reference index");
  if (ref.kind === "skill" && !(profile.skills || [])[index!]) throw new Error("Invalid job analysis: unsupported candidate skill reference");
  if (ref.kind === "experience" && !(profile.experience || [])[index!]) throw new Error("Invalid job analysis: unsupported candidate experience reference");
  if (ref.kind === "education" && !(profile.education || [])[index!]) throw new Error("Invalid job analysis: unsupported candidate education reference");
  if (ref.kind === "language" && !(profile.languages || [])[index!]) throw new Error("Invalid job analysis: unsupported candidate language reference");
  if (ref.kind === "experienceBullet") { if (!Number.isInteger(ref.bulletIndex) || ref.bulletIndex! < 0 || !(profile.experience || [])[index!]?.bullets?.[ref.bulletIndex!]) throw new Error("Invalid job analysis: unsupported candidate experience bullet reference"); }
  return { kind: ref.kind, index, ...(ref.kind === "experienceBullet" ? { bulletIndex: ref.bulletIndex } : {}) } as CandidateFactRef;
}

function validateEvidence(value: unknown, jd: string, name: string): Evidence {
  const item = record(value, name);
  return { text: text(item.text, `${name}.text`), evidence: jdIncludes(jd, item.evidence, `${name}.evidence`) };
}

export function validateJobAnalysis(value: unknown, job: any, profile: FactualProfile): JobAnalysis {
  if (job.content_status === "INSUFFICIENT") throw new Error("INSUFFICIENT_SOURCE_CONTENT: this job is retained for Review, but cannot be evaluated or tailored.");
  const raw = record(value, "payload"), jd = String(job.jd_original || "");
  if (raw.schemaVersion !== JOB_ANALYSIS_SCHEMA_VERSION) throw new Error("Invalid job analysis: schemaVersion");
  if (raw.jobId !== job.job_id) throw new Error("Invalid job analysis: jobId does not match the selected permanent Job ID");
  const roleRaw = record(raw.role, "role");
  const interpretation = (key: "seniority" | "workModel" | "location") => roleRaw[key] === undefined ? undefined : validateEvidence(roleRaw[key], jd, `role.${key}`);
  const requirements = list(raw.requirements, "requirements").map((item) => validateEvidence(item, jd, "requirement"));
  const requirementTexts = new Set(requirements.map((item) => item.text));
  const matches = list(raw.matches, "matches").map((item) => { const match = record(item, "match"), requirement = text(match.requirement, "match.requirement"); if (!requirementTexts.has(requirement)) throw new Error("Invalid job analysis: match must reference a factual JD requirement"); return { requirement, candidateFactRefs: list(match.candidateFactRefs, "match.candidateFactRefs").map((ref) => validateFactRef(ref, profile)) }; });
  const gaps = list(raw.gaps, "gaps").map((item) => validateEvidence(item, jd, "gap"));
  const germanyDachConsiderations = list(raw.germanyDachConsiderations, "germanyDachConsiderations").map((item) => { const consideration = record(item, "Germany/DACH consideration"), topic = text(consideration.topic, "Germany/DACH topic") as JobAnalysis["germanyDachConsiderations"][number]["topic"]; if (!["language", "employmentType", "workModel", "location", "probationOrNotice", "collectiveAgreement", "thirteenthSalary", "vwl", "bav", "applicationDocuments"].includes(topic)) throw new Error("Invalid job analysis: Germany/DACH topic"); return { topic, evidence: jdIncludes(jd, consideration.evidence, "Germany/DACH evidence") }; });
  const strengths = list(raw.strengths, "strengths").map((ref) => validateFactRef(ref, profile));
  const keywords = list(raw.keywords, "keywords").map((item) => { const keyword = record(item, "keyword"), priority = keyword.priority; if (!Number.isInteger(priority) || priority < 1) throw new Error("Invalid job analysis: keyword priority"); return { text: text(keyword.text, "keyword.text"), priority, evidence: jdIncludes(jd, keyword.evidence, "keyword.evidence") }; });
  const planRaw = record(raw.tailoringPlan, "tailoringPlan"), skillIndexes = list(planRaw.skillIndexes, "tailoringPlan.skillIndexes");
  if (skillIndexes.some((index) => !Number.isInteger(index) || !(profile.skills || [])[index])) throw new Error("Invalid job analysis: tailoring plan has an unsupported skill");
  const experiences = list(planRaw.experiences, "tailoringPlan.experiences").map((item) => { const experience = record(item, "tailoring plan experience"), index = experience.index; if (!Number.isInteger(index) || !(profile.experience || [])[index]) throw new Error("Invalid job analysis: tailoring plan has an unsupported experience"); const bulletIndexes = list(experience.bulletIndexes, "tailoring plan bullet indexes"); if (bulletIndexes.some((bulletIndex) => !Number.isInteger(bulletIndex) || !(profile.experience || [])[index].bullets?.[bulletIndex])) throw new Error("Invalid job analysis: tailoring plan has an unsupported experience bullet"); return { index, bulletIndexes }; });
  const keywordsForPlan = list(planRaw.keywords, "tailoringPlan.keywords").map((keyword) => text(keyword, "tailoringPlan keyword"));
  if (keywordsForPlan.some((keyword) => !keywords.some((item) => item.text === keyword))) throw new Error("Invalid job analysis: tailoring plan keyword is not a JD keyword");
  const evaluation = record(raw.evaluation, "evaluation"); if (typeof evaluation.score !== "number" || evaluation.score < 1 || evaluation.score > 5) throw new Error("Invalid job analysis: evaluation score must use the 1-5 model");
  const provenanceRaw = record(raw.provenance, "provenance"); if (provenanceRaw.candidateSource !== "profile/profile.yaml") throw new Error("Invalid job analysis: candidate provenance source"); const approvedFactRefs = list(provenanceRaw.approvedFactRefs, "provenance.approvedFactRefs").map((ref) => validateFactRef(ref, profile));
  const usedRefs = [...matches.flatMap((match) => match.candidateFactRefs), ...strengths, ...skillIndexes.map((index) => ({ kind: "skill" as const, index })), ...experiences.flatMap((experience) => [{ kind: "experience" as const, index: experience.index }, ...experience.bulletIndexes.map((bulletIndex) => ({ kind: "experienceBullet" as const, index: experience.index, bulletIndex }))])];
  if (usedRefs.some((used) => !approvedFactRefs.some((approved) => sameRef(used, approved)))) throw new Error("Invalid job analysis: candidate claim lacks approved profile provenance");
  const unsupportedClaims = list(raw.unsupportedClaims, "unsupportedClaims"); if (unsupportedClaims.some((claim) => typeof claim !== "string") || unsupportedClaims.length) throw new Error("Invalid job analysis: unsupported candidate claims must be empty");
  return { schemaVersion: JOB_ANALYSIS_SCHEMA_VERSION, jobId: job.job_id, role: { archetype: text(roleRaw.archetype, "role.archetype"), seniority: interpretation("seniority"), workModel: interpretation("workModel"), location: interpretation("location") }, requirements, matches, gaps, germanyDachConsiderations, strengths, keywords, tailoringPlan: { skillIndexes, experiences, keywords: keywordsForPlan }, evaluation: { score: evaluation.score }, provenance: { candidateSource: "profile/profile.yaml", approvedFactRefs }, unsupportedClaims: [] };
}

function selectedJob(jobId: string) { const job = getJob(jobId); if (!job) throw new Error("Unknown Job ID"); if (job.content_status === "INSUFFICIENT") throw new Error("INSUFFICIENT_SOURCE_CONTENT: this job is retained for Review, but cannot be evaluated or tailored."); return job; }
function requiredProfile() { const profile = loadFactualProfile(); if (!profile) throw new Error("SETUP_REQUIRED: add private profile/profile.yaml with factual candidate data before evaluation."); return profile; }

export function buildEvaluationInput(jobId: string) {
  const job = selectedJob(jobId), profile = requiredProfile();
  return { job: { jobId: job.job_id, company: job.company, title: job.title, location: job.location, workModel: job.work_model, canonicalUrl: job.canonical_url, canonicalSource: job.canonical_source, jd: job.jd_original }, profile, policy: Object.fromEntries(policyPaths.map((file) => [file, loadCareerOpsMode(file)])) };
}

export function persistJobAnalysis(jobId: string, value: unknown) {
  const job = selectedJob(jobId), analysis = validateJobAnalysis(value, job, requiredProfile()), d = db();
  d.transaction(() => { d.prepare("UPDATE jobs SET analysis_json=?, status='ANALYZED', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(analysis), job.id); d.prepare("INSERT INTO audit_events(job_id,action,detail) VALUES(?,?,?)").run(job.id, "AGENT_ANALYSIS_PERSISTED", JSON.stringify({ schemaVersion: analysis.schemaVersion, score: analysis.evaluation.score })); })();
  return analysis;
}

export function readJobAnalysis(jobId: string) {
  const job = selectedJob(jobId); if (!job.analysis_json) return undefined;
  try { return validateJobAnalysis(JSON.parse(job.analysis_json), job, requiredProfile()); } catch (error: any) { throw new Error(`Stored job analysis is invalid: ${error.message}`); }
}

export function readUsableJobAnalysis(jobId: string) {
  try { return readJobAnalysis(jobId); } catch { return undefined; }
}
