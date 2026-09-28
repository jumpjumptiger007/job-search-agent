import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDb, db } from "../lib/db";
import { loadFactualProfile } from "../lib/profile";
import { materialArtifacts } from "../lib/materials";
import { runDiscovery } from "../lib/discovery";
import { careerOpsPaths } from "../lib/integrations/career-ops/paths";
import { linkedinCliPath } from "../lib/integrations/linkedin";
import { rendercvBin } from "../lib/integrations/rendercv";

const envNames = ["JOB_AGENT_WORKSPACE_ROOT", "JOB_AGENT_DB_PATH", "JOB_AGENT_STORAGE_ROOT"] as const;
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const originalCwd = process.cwd();
let temporary = "";

afterEach(() => {
  closeDb();
  process.chdir(originalCwd);
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
});

describe("explicit workspace root", () => {
  it("anchors runtime data and integrations when cwd is the standalone directory", async () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-project-root-"));
    const workspace = path.join(temporary, "workspace");
    const standalone = path.join(workspace, ".next", "standalone");
    fs.mkdirSync(path.join(workspace, "config"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "profile"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "vendor", "career-ops", "providers"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "vendor", "career-ops", "modes"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "vendor", "career-ops", "VERSION"), "1.34.0\n");
    fs.writeFileSync(path.join(workspace, "config", "preferences.yaml"), "discovery:\n  roleFamilies: [Workspace Engineer]\n  location: Germany\n");
    fs.writeFileSync(path.join(workspace, "config", "search.yaml"), "linkedin:\n  enabled: true\n  limit: 1\n");
    fs.writeFileSync(path.join(workspace, "profile", "profile.yaml"), "name: Workspace Candidate\n");
    fs.mkdirSync(path.join(workspace, "jobs", "JOB-0001", "resume"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "jobs", "JOB-0001", "resume", "resume.pdf"), "temporary artifact");
    fs.mkdirSync(standalone, { recursive: true });
    process.chdir(standalone);
    process.env.JOB_AGENT_WORKSPACE_ROOT = workspace;
    delete process.env.JOB_AGENT_DB_PATH;
    delete process.env.JOB_AGENT_STORAGE_ROOT;

    const calls: string[][] = [];
    const result = await runDiscovery(undefined, { linkedinRunner: async (args) => { calls.push(args); return JSON.stringify({ results: [] }); } });

    expect(db().name).toBe(path.join(workspace, "data", "job-agent.db"));
    expect(result.configured).toBe(1);
    expect(calls[0]).toEqual(expect.arrayContaining(["--query", "Workspace Engineer", "--location", "Germany"]));
    expect(loadFactualProfile()?.name).toBe("Workspace Candidate");
    expect(materialArtifacts({ folder_path: path.join("jobs", "JOB-0001") })).toContainEqual(expect.objectContaining({ file: path.join(workspace, "jobs", "JOB-0001", "resume", "resume.pdf") }));
    expect(careerOpsPaths().root).toBe(path.join(workspace, "vendor", "career-ops"));
    expect(linkedinCliPath()).toBe(path.join(workspace, ".agents", "skills", "linkedin-search", "cli", "src", "cli.ts"));
    expect(rendercvBin()).toBe(path.join(workspace, ".rendercv-venv", "bin", "rendercv"));
  });

  it("keeps explicit database and storage test overrides", () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-project-root-overrides-"));
    const workspace = path.join(temporary, "workspace"), storage = path.join(temporary, "storage");
    fs.mkdirSync(path.join(storage, "profile"), { recursive: true });
    fs.writeFileSync(path.join(storage, "profile", "profile.yaml"), "name: Override Candidate\n");
    process.env.JOB_AGENT_WORKSPACE_ROOT = workspace;
    process.env.JOB_AGENT_DB_PATH = path.join(temporary, "override.sqlite");
    process.env.JOB_AGENT_STORAGE_ROOT = storage;

    expect(db().name).toBe(path.join(temporary, "override.sqlite"));
    expect(loadFactualProfile()?.name).toBe("Override Candidate");
  });
});
