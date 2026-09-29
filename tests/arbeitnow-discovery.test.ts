import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { runDiscovery } from "../lib/discovery";
import { ArbeitnowAdapter, type ArbeitnowFetcher } from "../lib/integrations/arbeitnow";
import { ingest } from "../lib/jobs";

const endpoint = "https://www.arbeitnow.com/api/job-board-api";
const description = "Build and maintain reliable software services for customers in Germany. Collaborate closely with product and engineering teams to deliver useful improvements.";
const job = (slug: string, title = "Senior Engineer") => ({
  slug,
  company_name: "Acme",
  title,
  location: "Berlin, Germany",
  url: `https://www.arbeitnow.com/jobs/${slug}`,
  description,
  remote: true,
  created_at: 1_786_516_800
});
const apiResponse = (data: unknown[], next: string | null = null) => new Response(JSON.stringify({ data, links: { next } }), { status: 200 });

let directory: string, originalCwd: string, previousDbPath: string | undefined, previousStorageRoot: string | undefined;
beforeEach(() => {
  originalCwd = process.cwd();
  previousDbPath = process.env.JOB_AGENT_DB_PATH;
  previousStorageRoot = process.env.JOB_AGENT_STORAGE_ROOT;
  directory = fs.mkdtempSync("/private/tmp/arbeitnow-discovery-");
  fs.mkdirSync(path.join(directory, "config"));
  process.env.JOB_AGENT_DB_PATH = path.join(directory, "jobs.sqlite");
  process.env.JOB_AGENT_STORAGE_ROOT = path.join(directory, "store");
  closeDb();
  process.chdir(directory);
});
afterEach(() => {
  closeDb();
  process.chdir(originalCwd);
  if (previousDbPath === undefined) delete process.env.JOB_AGENT_DB_PATH;
  else process.env.JOB_AGENT_DB_PATH = previousDbPath;
  if (previousStorageRoot === undefined) delete process.env.JOB_AGENT_STORAGE_ROOT;
  else process.env.JOB_AGENT_STORAGE_ROOT = previousStorageRoot;
  fs.rmSync(directory, { recursive: true, force: true });
});

const writeConfig = (search: string, preferences = "roleFamilies: [Engineer]\nlocation: Germany\n") => {
  fs.writeFileSync("config/search.yaml", search);
  fs.writeFileSync("config/preferences.yaml", `discovery:\n${preferences.split("\n").filter(Boolean).map(line => `  ${line}`).join("\n")}\n`);
};

describe("Arbeitnow Discovery", () => {
  it("normalizes a public API record without inventing ATS metadata", async () => {
    const fetcher: ArbeitnowFetcher = async input => {
      expect(String(input)).toBe(endpoint);
      return apiResponse([{
        ...job("software-engineer-berlin"),
        description: "&lt;p&gt;Build &amp; maintain reliable software services for customers in Germany. Collaborate with product, design, and engineering teams to deliver useful improvements.&lt;/p&gt;&lt;script&gt;ignored text&lt;/script&gt;",
        remote: true
      }]);
    };

    const [found] = await new ArbeitnowAdapter(10, fetcher).discover();
    expect(found).toMatchObject({
      sourceName: "Arbeitnow",
      externalId: "arbeitnow:software-engineer-berlin",
      company: "Acme",
      title: "Senior Engineer",
      location: "Berlin, Germany",
      url: "https://www.arbeitnow.com/jobs/software-engineer-berlin",
      description: "Build & maintain reliable software services for customers in Germany. Collaborate with product, design, and engineering teams to deliver useful improvements.",
      contentStatus: "SUBSTANTIVE",
      postedAt: new Date(1_786_516_800 * 1000).toISOString(),
      workModel: "remote",
      discoveredVia: "Arbeitnow public API"
    });
    expect(found.ats).toBeUndefined();
  });

  it("uses a canonical URL identity when the slug is unusable and skips unusable postings", async () => {
    const fetcher: ArbeitnowFetcher = async () => apiResponse([
      { company_name: "Acme", title: "Engineer", location: "", url: "https://jobs.acme.example/careers/engineer#details", description: "", created_at: "invalid", remote: false },
      { slug: "home", company_name: "Acme", title: "Engineer", url: "https://acme.example/", description },
      { slug: "bad-url", company_name: "Acme", title: "Engineer", url: "javascript:alert(1)", description },
      { slug: "missing-title", company_name: "Acme", title: "", url: "https://jobs.acme.example/jobs/2", description }
    ]);

    const jobs = await new ArbeitnowAdapter(10, fetcher).discover();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: "arbeitnow:https://jobs.acme.example/careers/engineer",
      url: "https://jobs.acme.example/careers/engineer",
      description: "",
      contentStatus: "INSUFFICIENT"
    });
    expect(jobs[0].location).toBeUndefined();
    expect(jobs[0].postedAt).toBeUndefined();
    expect(jobs[0].workModel).toBeUndefined();
  });

  it("honors the raw-candidate cap and follows API pagination only as needed", async () => {
    const calls: string[] = [];
    const fetcher: ArbeitnowFetcher = async input => {
      const url = String(input);
      calls.push(url);
      return url.includes("page=2")
        ? apiResponse([job("third"), job("fourth")], `${endpoint}?page=3`)
        : apiResponse([job("first"), job("second")], `${endpoint}?page=2`);
    };

    const jobs = await new ArbeitnowAdapter(3, fetcher).discover();
    expect(jobs.map(candidate => candidate.externalId)).toEqual(["arbeitnow:first", "arbeitnow:second", "arbeitnow:third"]);
    expect(calls).toEqual([endpoint, `${endpoint}?page=2`]);
  });

  it("suppresses duplicate stable IDs and stops repeated or excessive pagination", async () => {
    const duplicateFetcher: ArbeitnowFetcher = async () => apiResponse([job("same"), job("same"), job("two"), job("three"), job("four")]);
    const uniqueJobs = await new ArbeitnowAdapter(5, duplicateFetcher).discover();
    expect(uniqueJobs.map(candidate => candidate.externalId)).toEqual(["arbeitnow:same", "arbeitnow:two", "arbeitnow:three", "arbeitnow:four"]);

    let repeatedCalls = 0;
    const repeatedFetcher: ArbeitnowFetcher = async input => {
      repeatedCalls++;
      return String(input).includes("page=2") ? apiResponse([], endpoint) : apiResponse([], `${endpoint}?page=2`);
    };
    await new ArbeitnowAdapter(20, repeatedFetcher).discover();
    expect(repeatedCalls).toBe(2);

    let boundedCalls = 0;
    const boundedFetcher: ArbeitnowFetcher = async input => {
      boundedCalls++;
      const page = new URL(String(input)).searchParams.get("page") || "1";
      return apiResponse([], `${endpoint}?page=${Number(page) + 1}`);
    };
    await new ArbeitnowAdapter(20, boundedFetcher).discover();
    expect(boundedCalls).toBe(3);

    let unrelatedCalls = 0;
    const unrelatedFetcher: ArbeitnowFetcher = async () => {
      unrelatedCalls++;
      return apiResponse([], "https://example.invalid/jobs?page=2");
    };
    await new ArbeitnowAdapter(20, unrelatedFetcher).discover();
    expect(unrelatedCalls).toBe(1);
  });

  it("does not call or count a disabled source", async () => {
    writeConfig("arbeitnow:\n  enabled: false\n  limit: 10\n");
    const fetcher = vi.fn<ArbeitnowFetcher>(async () => apiResponse([job("unused")]));
    const result = await runDiscovery("config/search.yaml", { arbeitnowFetcher: fetcher });
    expect(result.configured).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the canonical preference filter and keeps provider failures isolated", async () => {
    writeConfig("arbeitnow:\n  enabled: true\n  limit: 10\n");
    const fetcher: ArbeitnowFetcher = async () => apiResponse([job("engineer"), { ...job("sales", "Sales Manager"), description: "Build a sales pipeline and manage customer relationships." }]);
    const result = await runDiscovery("config/search.yaml", { arbeitnowFetcher: fetcher });
    expect(result).toMatchObject({ configured: 1, failures: 0, seen: 1, filteredCandidates: 1, newJobs: 1 });
    expect(db().prepare("SELECT title FROM jobs").all()).toEqual([{ title: "Senior Engineer" }]);

    writeConfig("arbeitnow:\n  enabled: true\n  limit: 10\nproviders:\n  - type: greenhouse\n    board: acme\n    enabled: true\n");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ jobs: [{ id: 8, title: "Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/8", content: description, location: { name: "Berlin, Germany" } }] }));
    try {
      const isolated = await runDiscovery("config/search.yaml", { arbeitnowFetcher: async () => { throw new Error("HTTP 503"); }, careerOpsProjectRoot: originalCwd });
      expect(isolated).toMatchObject({ configured: 2, failures: 1, newJobs: 1 });
      expect(isolated.errors[0]).toContain("Arbeitnow: HTTP 503");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("leaves permanent identity and cross-source dedupe with the existing ingestion boundary", async () => {
    const found = (await new ArbeitnowAdapter(1, async () => apiResponse([job("stable-id")])).discover())[0];
    const first = ingest(found), repeated = ingest(found);
    expect(repeated.created).toBe(false);
    expect(repeated.job.job_id).toBe(first.job.job_id);
    expect(db().prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({ count: 1 });
  });
});
