import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
import { PDFDocument } from "pdf-lib";
import { validateFactualProfile, type FactualProfile } from "../../profile";
import { type JobAnalysis } from "../../agent-workflow";

export const RENDERCV_VERSION = "2.8";
export const RENDERCV_THEME = "engineeringresumes";
export const rendercvBin = () => process.env.RENDERCV_BIN || path.join(process.cwd(), ".rendercv-venv", "bin", "rendercv");
export type RenderCVRunner = (argv: string[]) => void;

export const runRenderCV: RenderCVRunner = (argv) => {
  const result = spawnSync(rendercvBin(), argv, { encoding: "utf8", timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`RenderCV failed: ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}`);
};

export function buildRenderCVDocument(profile: FactualProfile, analysis: JobAnalysis) {
  validateFactualProfile(profile);
  const plan = analysis.tailoringPlan;
  const skills = plan.skillIndexes.map((index) => {
    const skill = profile.skills?.[index];
    if (!skill) throw new Error("Invalid tailoring plan: unsupported skill");
    return skill;
  });
  const experience = plan.experiences.map(({ index, bulletIndexes }) => {
    const fact = profile.experience?.[index];
    if (!fact) throw new Error("Invalid tailoring plan: unsupported experience");
    const highlights = bulletIndexes.map((bulletIndex) => {
      const bullet = fact.bullets?.[bulletIndex];
      if (!bullet) throw new Error("Invalid tailoring plan: unsupported experience bullet");
      return bullet;
    });
    return { company: fact.employer, position: fact.title, ...(fact.dates ? { date: fact.dates } : {}), ...(highlights.length ? { highlights } : {}) };
  });
  return {
    // Fixed release schema; YAML is a generated artifact, never operational state.
    cv: {
      name: profile.name,
      ...(profile.location ? { location: profile.location } : {}),
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.phone ? { phone: profile.phone } : {}),
      sections: {
        ...(profile.summary ? { "Profile Summary": [profile.summary] } : {}),
        ...(skills.length ? { Skills: skills } : {}),
        ...(experience.length ? { Experience: experience } : {}),
        ...(profile.education?.length ? { Education: profile.education } : {}),
      },
    },
    design: { theme: RENDERCV_THEME },
  };
}

export async function renderResume(profile: FactualProfile, analysis: JobAnalysis, destination: string, runner: RenderCVRunner = runRenderCV) {
  const yaml = YAML.stringify(buildRenderCVDocument(profile, analysis));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-rendercv-"));
  try {
    const input = path.join(temporary, "rendercv.yaml");
    const output = path.join(temporary, "output");
    fs.writeFileSync(input, `# yaml-language-server: $schema=https://raw.githubusercontent.com/rendercv/rendercv/v2.8/schema.json\n${yaml}`);
    runner(["render", input, "--output-folder", "output", "--pdf-path", "OUTPUT_FOLDER/resume.pdf", "--dont-generate-markdown", "--dont-generate-png", "--quiet"]);
    const pdf = path.join(output, "resume.pdf");
    if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 100) throw new Error("RenderCV did not produce a nontrivial PDF");
    const parsed = await PDFDocument.load(fs.readFileSync(pdf));
    if (!parsed.getPageCount()) throw new Error("RenderCV PDF has no pages");
    fs.mkdirSync(destination, { recursive: true });
    const id = randomUUID();
    const stagedYaml = path.join(destination, `.rendercv-${id}.yaml`);
    const stagedPdf = path.join(destination, `.resume-${id}.pdf`);
    try {
      fs.copyFileSync(input, stagedYaml);
      fs.copyFileSync(pdf, stagedPdf);
      fs.renameSync(stagedPdf, path.join(destination, "resume.pdf"));
      fs.renameSync(stagedYaml, path.join(destination, "rendercv.yaml"));
    } finally {
      fs.rmSync(stagedYaml, { force: true });
      fs.rmSync(stagedPdf, { force: true });
    }
    return { resumeYaml: path.join(destination, "rendercv.yaml"), resumePdf: path.join(destination, "resume.pdf") };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
