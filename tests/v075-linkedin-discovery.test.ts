import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { runDiscovery } from "../lib/discovery";
import { LinkedInAdapter, type LinkedInRunner } from "../lib/integrations/linkedin";
import { ingest } from "../lib/jobs";

const description = "Build reliable TypeScript services for customers in Germany. Collaborate with product and engineering teams in Berlin.";
const card = (id: string, title = "Senior Engineer") => ({ id, title, company: "Acme", location: "Berlin, Germany", date: "2026-09-24", url: `https://www.linkedin.com/jobs/view/${id}` });
const detail = (id: string) => ({ id, title: "Senior Engineer", company: "Acme", location: "Berlin, Germany", description, employmentType: "Full-time", applyUrl: "https://example.com/apply" });
const fixture = (cards = [card("123456")], details: Record<string, unknown> = { "123456": detail("123456") }) => {
  const calls: string[][] = [];
  const runner: LinkedInRunner = async args => { calls.push(args); if (args[0] === "search") return JSON.stringify({ results: cards }); const row = details[args[1]]; if (row instanceof Error) throw row; return JSON.stringify(row); };
  return { calls, runner };
};
let directory: string, originalCwd: string;
beforeEach(() => { originalCwd = process.cwd(); directory = fs.mkdtempSync("/private/tmp/v075-linkedin-"); fs.mkdirSync(path.join(directory, "config")); process.env.JOB_AGENT_DB_PATH = path.join(directory, "jobs.sqlite"); process.env.JOB_AGENT_STORAGE_ROOT = path.join(directory, "store"); closeDb(); process.chdir(directory); });
afterEach(() => { closeDb(); process.chdir(originalCwd); delete process.env.JOB_AGENT_DB_PATH; delete process.env.JOB_AGENT_STORAGE_ROOT; fs.rmSync(directory, { recursive: true, force: true }); });
const config = (search: string, preferences = "roleFamilies: [Engineer]\nlocation: Germany\n") => { fs.writeFileSync("config/search.yaml", search); fs.writeFileSync("config/preferences.yaml", `discovery:\n  ${preferences.replaceAll("\n", "\n  ")}`); };

describe("v0.7.5 LinkedIn discovery", () => {
  it("does not invoke Bun or LinkedIn when disabled, and skips empty role families when enabled", async () => {
    const { calls, runner } = fixture(); config("linkedin:\n  enabled: false\n");
    expect((await runDiscovery("config/search.yaml", { linkedinRunner: runner })).configured).toBe(0);
    config("linkedin:\n  enabled: true\n", "roleFamilies: []\n");
    expect((await runDiscovery("config/search.yaml", { linkedinRunner: runner })).seen).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("deduplicates role queries, bounds pages/details, and maps Germany, remote, and broad age", async () => {
    const { calls, runner } = fixture([card("123456"), card("123457"), card("123458")], { "123456": detail("123456"), "123457": detail("123457") });
    const jobs = await new LinkedInAdapter({ roleFamilies: ["Engineer", " Engineer ", "Data Engineer"], location: "Germany", remotePreference: "remote", postingAgeDays: 8 }, 2, runner).discover();
    expect(jobs).toHaveLength(2);
    expect(calls.filter(args => args[0] === "search")).toHaveLength(1);
    expect(calls.filter(args => args[0] === "detail")).toHaveLength(2);
    expect(calls[0]).toEqual(["search", "--query", "Engineer", "--location", "Germany", "--page", "1", "--limit", "2", "--format", "json", "--remote", "remote", "--jobage", "14"]);
    expect(jobs[0]).toMatchObject({ sourceName: "LinkedIn", externalId: "linkedin:123456", url: "https://www.linkedin.com/jobs/view/123456", company: "Acme", title: "Senior Engineer", location: "Berlin, Germany", description, contentStatus: "SUBSTANTIVE", postedAt: "2026-09-24T00:00:00.000Z", workModel: "remote", discoveredVia: "LinkedIn public jobs" });
    expect(jobs[0].ats).toBeUndefined(); expect(JSON.stringify(jobs[0])).not.toContain("applyUrl");
  });

  it("runs each unique role query at most once while respecting the shared source limit", async () => {
    const calls: string[][] = [];
    const runner: LinkedInRunner = async args => { calls.push(args); return args[0] === "search" ? JSON.stringify({ results: [card(args[args.indexOf("--query") + 1] === "Engineer" ? "123456" : "123457")] }) : JSON.stringify(detail(args[1])); };
    const jobs = await new LinkedInAdapter({ roleFamilies: ["Engineer", "Engineer", "Data Engineer"] }, 2, runner).discover();
    expect(jobs).toHaveLength(2);
    expect(calls.filter(args => args[0] === "search").map(args => args[args.indexOf("--query") + 1])).toEqual(["Engineer", "Data Engineer"]);
    expect(calls.filter(args => args[0] === "detail")).toHaveLength(2);
  });

  it("tries the next role after an empty result, then stops at one accepted job and detail", async () => {
    const calls: string[][] = [];
    const runner: LinkedInRunner = async args => {
      calls.push(args);
      if (args[0] === "detail") return JSON.stringify(detail(args[1]));
      return JSON.stringify({ results: args[args.indexOf("--query") + 1] === "Engineer" ? [card("123456")] : [] });
    };
    const jobs = await new LinkedInAdapter({ roleFamilies: ["No Match Role", "No Match Role", "Engineer", "Later Role"] }, 1, runner).discover();
    expect(jobs.map(job => job.externalId)).toEqual(["linkedin:123456"]);
    expect(calls.filter(args => args[0] === "search").map(args => args[args.indexOf("--query") + 1])).toEqual(["No Match Role", "Engineer"]);
    expect(calls.filter(args => args[0] === "detail")).toHaveLength(1);
  });

  it("attempts no more than five unique role queries when all searches are empty", async () => {
    const calls: string[][] = [];
    const runner: LinkedInRunner = async args => { calls.push(args); return JSON.stringify({ results: [] }); };
    const jobs = await new LinkedInAdapter({ roleFamilies: ["One", " One ", "Two", "Three", "Four", "Five", "Six"] }, 1, runner).discover();
    expect(jobs).toEqual([]);
    expect(calls.map(args => args[args.indexOf("--query") + 1])).toEqual(["One", "Two", "Three", "Four", "Five"]);
    expect(calls.every(args => args[0] === "search" && args[args.indexOf("--page") + 1] === "1" && args[args.indexOf("--limit") + 1] === "1")).toBe(true);
  });

  it.each([[1,"1"],[2,"7"],[7,"7"],[15,"30"],[30,"30"],[31,undefined],[undefined,undefined]])("uses a provider age window no narrower than %s days", async (days, expected) => {
    const { calls, runner } = fixture(); await new LinkedInAdapter({ roleFamilies: ["Engineer"], postingAgeDays: days }, 1, runner).discover();
    expect(calls[0].includes("--jobage") ? calls[0][calls[0].indexOf("--jobage") + 1] : undefined).toBe(expected);
    expect(calls[0]).toContain("Germany");
  });

  it.each([["hybrid","hybrid"],["onsite","onsite"],["on-site","onsite"],["any",undefined],["unsupported",undefined]])("maps workplace preference %s", async (preference, expected) => {
    const { calls, runner } = fixture(); await new LinkedInAdapter({ roleFamilies: ["Engineer"], location: "Munich", remotePreference: preference }, 1, runner).discover();
    expect(calls[0]).toContain("Munich");
    expect(calls[0].includes("--remote") ? calls[0][calls[0].indexOf("--remote") + 1] : undefined).toBe(expected);
  });

  it("rejects nonnumeric identities and preserves siblings after detail failure", async () => {
    const { runner, calls } = fixture([card("bad-id"), card("123456"), card("123457"), card("123458")], { "123456": new Error("HTTP 429"), "123457": detail("123457") });
    const jobs = await new LinkedInAdapter({ roleFamilies: ["Engineer"] }, 3, runner).discover();
    expect(jobs.map(job => job.externalId)).toEqual(["linkedin:123456", "linkedin:123457"]);
    expect(jobs[0]).toMatchObject({ description: "", contentStatus: "INSUFFICIENT" });
    expect(jobs[1].contentStatus).toBe("SUBSTANTIVE");
    expect(calls.filter(args => args[0] === "detail")).toHaveLength(2);
  });

  it("does not invent dates or descriptions when detail lacks them", async () => {
    const { runner } = fixture([{ ...card("123456"), date: "invalid" }], { "123456": { id: "123456", title: "(untitled)", employmentType: "Remote" } });
    const [job] = await new LinkedInAdapter({ roleFamilies: ["Engineer"] }, 1, runner).discover();
    expect(job).toMatchObject({ company: "Acme", title: "Senior Engineer", description: "", contentStatus: "INSUFFICIENT" });
    expect(job.postedAt).toBeUndefined(); expect(job.workModel).toBeUndefined();
  });

  it("isolates search failure from another configured source in runDiscovery", async () => {
    config("linkedin:\n  enabled: true\n  limit: 1\nproviders:\n  - type: greenhouse\n    board: acme\n    enabled: true\n");
    const originalFetch = globalThis.fetch; globalThis.fetch = async () => new Response(JSON.stringify({ jobs: [{ id: 8, title: "Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/8", content: "TypeScript engineering in Berlin" }] }));
    try { const result = await runDiscovery("config/search.yaml", { linkedinRunner: async () => { throw new Error("HTTP 429"); } }); expect(result).toMatchObject({ configured: 2, failures: 1, newJobs: 1 }); expect(result.errors[0]).toContain("LinkedIn: HTTP 429"); }
    finally { globalThis.fetch = originalFetch; }
  });

  it("keeps one permanent ID for LinkedIn rediscovery and an official ATS match", async () => {
    const { runner } = fixture(); const [job] = await new LinkedInAdapter({ roleFamilies: ["Engineer"] }, 1, runner).discover();
    const first = ingest(job); const repeated = ingest(job);
    const official = ingest({ ...job, sourceName: "Greenhouse", ats: "Greenhouse", externalId: "greenhouse:acme:8", url: "https://boards.greenhouse.io/acme/jobs/8" });
    expect(repeated.created).toBe(false); expect(official.created).toBe(false);
    expect(repeated.job.job_id).toBe(first.job.job_id); expect(official.job.job_id).toBe(first.job.job_id);
    expect(db().prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({ count: 1 });
  });
});
