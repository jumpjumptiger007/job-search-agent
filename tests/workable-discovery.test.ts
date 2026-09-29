import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { runDiscovery } from "../lib/discovery";
import { ArbeitnowAdapter, type ArbeitnowFetcher } from "../lib/integrations/arbeitnow";
import { WorkableAdapter, type WorkableFetcher } from "../lib/integrations/workable";
import { ingest } from "../lib/jobs";

const endpoint = "https://jobs.workable.com/api/v1/jobs";
const description = "<p>Build and maintain reliable software services for customers in Germany. Collaborate with product and engineering teams to deliver useful improvements.</p>";
const job = (id: string, title = "Software Engineer") => ({
  id,
  title,
  company: { title: "Acme" },
  location: { city: "Berlin", subregion: "Berlin", countryName: "Germany" },
  url: `https://jobs.workable.com/view/${id}/software-engineer-in-berlin-at-acme`,
  description,
  created: "2026-09-24T10:00:00.000Z",
  workplace: "remote"
});
const apiResponse = (jobs: unknown[], nextPageToken?: string) =>
  new Response(JSON.stringify({ title: "Workable Jobs", totalSize: jobs.length, jobs, nextPageToken }), { status: 200 });

let directory: string, originalCwd: string, previousDbPath: string | undefined, previousStorageRoot: string | undefined;
beforeEach(() => {
  originalCwd = process.cwd();
  previousDbPath = process.env.JOB_AGENT_DB_PATH;
  previousStorageRoot = process.env.JOB_AGENT_STORAGE_ROOT;
  directory = fs.mkdtempSync("/private/tmp/workable-discovery-");
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

const writeConfig = (search: string, preferences = "roleFamilies: [Software Engineer]\nlocation: Germany\n") => {
  fs.writeFileSync("config/search.yaml", search);
  fs.writeFileSync("config/preferences.yaml", `discovery:\n${preferences.split("\n").filter(Boolean).map(line => `  ${line}`).join("\n")}\n`);
};

describe("Workable Discovery", () => {
  it("normalizes a public Germany search record with stable identity and substantive plain text", async () => {
    const fetcher: WorkableFetcher = async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe(endpoint);
      expect(url.searchParams.get("query")).toBe("Software Engineer");
      expect(url.searchParams.get("location")).toBe("Germany");
      expect(init?.headers).toMatchObject({ Accept: "application/json" });
      return apiResponse([{
        ...job("139b6286-4459-41e9-885f-b8d57be21f63"),
        description: `${description}<script>do not include this</script><style>hide this</style>`,
        requirementsSection: "<p>Experience building production software systems.</p>",
        benefitsSection: "<p>Flexible work hours.</p>",
        employmentType: "Full-time"
      }]);
    };

    const [found] = await new WorkableAdapter({ roleFamilies: ["Software Engineer"], location: "Germany" }, 10, fetcher).discover();
    expect(found).toMatchObject({
      sourceName: "Workable",
      externalId: "workable:139b6286-4459-41e9-885f-b8d57be21f63",
      company: "Acme",
      title: "Software Engineer",
      location: "Berlin, Germany",
      url: "https://jobs.workable.com/view/139b6286-4459-41e9-885f-b8d57be21f63/software-engineer-in-berlin-at-acme",
      contentStatus: "SUBSTANTIVE",
      postedAt: "2026-09-24T10:00:00.000Z",
      workModel: "remote",
      discoveredVia: "Workable public search"
    });
    expect(found.description).toContain("Experience building production software systems.");
    expect(found.description).not.toMatch(/do not include this|hide this|<[^>]+>/);
    expect(found.ats).toBeUndefined();
    expect(found).not.toHaveProperty("employmentType");
  });

  it("uses the Germany default, searches distinct existing role families, and respects the page bound", async () => {
    const calls: URL[] = [];
    const fetcher: WorkableFetcher = async input => {
      const url = new URL(String(input));
      calls.push(url);
      return apiResponse([job(`id-${calls.length}`, calls.length === 1 ? "Software Engineer" : "Product Manager")]);
    };

    const found = await new WorkableAdapter({ roleFamilies: ["Software Engineer", " Software Engineer ", "Product Manager"] }, 10, fetcher).discover();
    expect(found).toHaveLength(2);
    expect(calls.map(url => url.searchParams.get("query"))).toEqual(["Software Engineer", "Product Manager"]);
    expect(calls.every(url => url.searchParams.get("location") === "Germany")).toBe(true);
  });

  it("honors the raw result cap and follows Workable pageToken at most three pages", async () => {
    const calls: URL[] = [];
    const fetcher: WorkableFetcher = async input => {
      const url = new URL(String(input));
      calls.push(url);
      const page = calls.length;
      return apiResponse(Array.from({ length: 20 }, (_, index) => job(`page-${page}-job-${index}`)), `token-${page + 1}`);
    };

    const found = await new WorkableAdapter({ roleFamilies: ["Software Engineer", "Product Manager"] }, 50, fetcher).discover();
    expect(found).toHaveLength(50);
    expect(calls).toHaveLength(3);
    expect(calls.map(url => url.searchParams.get("pageToken"))).toEqual([null, "token-2", "token-3"]);
    expect(calls.every(url => url.searchParams.get("query") === "Software Engineer")).toBe(true);
  });

  it("stops repeated pagination tokens and suppresses duplicate IDs across role queries", async () => {
    let repeatCalls = 0;
    const repeated = new WorkableAdapter({ roleFamilies: ["Software Engineer"] }, 50, async () => {
      repeatCalls++;
      return apiResponse([job(`repeated-${repeatCalls}`)], "same-token");
    });
    expect(await repeated.discover()).toHaveLength(2);
    expect(repeatCalls).toBe(2);

    const seenQueries: string[] = [];
    const duplicateFetcher: WorkableFetcher = async input => {
      const url = new URL(String(input));
      const query = url.searchParams.get("query") || "";
      seenQueries.push(query);
      return apiResponse(query === "Software Engineer" ? [job("shared-id")] : [job("shared-id"), job("other-id", "Product Manager")]);
    };
    const deduplicated = await new WorkableAdapter({ roleFamilies: ["Software Engineer", "Product Manager"] }, 10, duplicateFetcher).discover();
    expect(seenQueries).toEqual(["Software Engineer", "Product Manager"]);
    expect(deduplicated.map(candidate => candidate.externalId)).toEqual(["workable:shared-id", "workable:other-id"]);
  });

  it("uses canonical URL identity when an ID is unusable and rejects unsafe or incomplete jobs", async () => {
    const fetcher: WorkableFetcher = async () => apiResponse([
      { ...job("bad-host"), url: "https://evil.example/view/bad-host" },
      { ...job("api-url"), url: `${endpoint}?job=api-url` },
      { ...job("missing-company"), company: {} },
      { ...job("missing-title"), title: " " },
      { ...job("title-only"), id: "", description: "Software Engineer", requirementsSection: "", benefitsSection: "", created: "invalid", workplace: "unknown" },
      { ...job("url-fallback"), id: "unsafe:id", url: "https://jobs.workable.com/view/url-fallback/job?source=search#details", created: "invalid", workplace: "unknown" }
    ]);

    const found = await new WorkableAdapter({ roleFamilies: ["Software Engineer"] }, 20, fetcher).discover();
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({
      externalId: "workable:https://jobs.workable.com/view/title-only/software-engineer-in-berlin-at-acme",
      contentStatus: "INSUFFICIENT"
    });
    expect(found[0].postedAt).toBeUndefined();
    expect(found[0].workModel).toBeUndefined();
    expect(found[1]).toMatchObject({
      externalId: "workable:https://jobs.workable.com/view/url-fallback/job",
      url: "https://jobs.workable.com/view/url-fallback/job"
    });
    expect(found[1].postedAt).toBeUndefined();
  });

  it("maps explicit workplace types and leaves missing or unsupported values unset", async () => {
    const values = ["remote", "hybrid", "on_site", undefined, "mostly remote"];
    const fetcher: WorkableFetcher = async () => apiResponse(values.map((workplace, index) => ({
      ...job(`workplace-${index}`), workplace
    })));
    const found = await new WorkableAdapter({ roleFamilies: ["Software Engineer"] }, 10, fetcher).discover();
    expect(found.map(candidate => candidate.workModel)).toEqual(["remote", "hybrid", "onsite", undefined, undefined]);
  });

  it("does not call a disabled source and skips searches without configured role families", async () => {
    writeConfig("workable:\n  enabled: false\n  limit: 10\n");
    const fetcher = vi.fn<WorkableFetcher>(async () => apiResponse([job("unused")]));
    const disabled = await runDiscovery("config/search.yaml", { workableFetcher: fetcher });
    expect(disabled.configured).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();

    const noRoles = await new WorkableAdapter({ roleFamilies: [], location: "Germany" }, 10, fetcher).discover();
    expect(noRoles).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("passes candidates through canonical preference filtering and existing ingestion dedupe", async () => {
    writeConfig("workable:\n  enabled: true\n  limit: 10\n");
    const fetcher: WorkableFetcher = async () => apiResponse([
      job("engineer-id"),
      { ...job("sales-id", "Sales Manager"), description: "Build a sales pipeline and manage customer relationships." }
    ]);

    const first = await runDiscovery("config/search.yaml", { workableFetcher: fetcher });
    expect(first).toMatchObject({ configured: 1, failures: 0, seen: 1, filteredCandidates: 1, newJobs: 1 });
    expect(db().prepare("SELECT title FROM jobs").all()).toEqual([{ title: "Software Engineer" }]);

    const duplicate = await runDiscovery("config/search.yaml", { workableFetcher: fetcher });
    expect(duplicate).toMatchObject({ configured: 1, failures: 0, seen: 1, duplicates: 1, newJobs: 0 });
    expect(db().prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({ count: 1 });
  });

  it("isolates Workable failure while another configured provider succeeds", async () => {
    writeConfig("arbeitnow:\n  enabled: true\n  limit: 10\nworkable:\n  enabled: true\n  limit: 10\n");
    const arbeitnowFetcher: ArbeitnowFetcher = async () => new Response(JSON.stringify({ data: [{
      slug: "from-arbeitnow", company_name: "Acme", title: "Software Engineer", location: "Berlin, Germany",
      url: "https://www.arbeitnow.com/jobs/from-arbeitnow", description: "Build and maintain reliable software services for customers in Germany.", remote: false
    }] }), { status: 200 });
    const result = await runDiscovery("config/search.yaml", {
      arbeitnowFetcher,
      workableFetcher: async () => { throw new Error("HTTP 503"); }
    });

    expect(result).toMatchObject({ configured: 2, failures: 1, newJobs: 1 });
    expect(result.errors).toContain("Workable: HTTP 503");
    expect(db().prepare("SELECT title FROM jobs").all()).toEqual([{ title: "Software Engineer" }]);
  });
});
