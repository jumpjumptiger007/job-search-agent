import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { runDiscovery, discoverWithRetry, isTransientDiscoveryError, WebSearchAdapter, BundesagenturAdapter } from "../lib/discovery";
import { discoveryRunPresentation, discoverySourceOutcomes, discoveryUnmatchedErrors, discoverySummary } from "../lib/dashboard";

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

const completed = (sources: string, errors = "", failures = errors ? 1 : 0) => ({ ended_at: "2026-10-04", sources_attempted: sources, errors, failures, new_jobs: 0, duplicates: 0, filtered_candidates: 0, accepted_candidates: 0 });

describe("Discovery reliability", () => {
  it("distinguishes completed zero results, partial failure, total failure and no usable sources", () => {
    expect(discoveryRunPresentation(completed("Arbeitnow, Workable")).status).toBe("Completed");
    const partial = completed("Arbeitnow, Workable", "Workable: HTTP 503");
    expect(discoveryRunPresentation(partial).status).toBe("Completed with issues");
    expect(discoverySourceOutcomes(partial)).toEqual([
      { name: "Arbeitnow", status: "succeeded", error: undefined },
      { name: "Workable", status: "failed", error: "HTTP 503" }
    ]);
    const failed = completed("Arbeitnow, Workable", "Arbeitnow: fetch failed\nWorkable: HTTP 503", 2);
    expect(discoveryRunPresentation(failed).status).toBe("Failed");
    expect(discoverySummary(failed)).toBe("0/2 sources succeeded");
    expect(discoveryRunPresentation(completed("")).status).toBe("Failed");
    expect(discoveryRunPresentation(completed("Arbeitnow", "Personio configuration: invalid")).status).toBe("Completed with issues");
    expect(discoveryRunPresentation(completed("", "Personio configuration: invalid")).status).toBe("Failed");
    expect(discoveryRunPresentation({ ended_at: "old", failures: 1 }).status).toBe("Completed with issues");
  });

  it.each([true, false])("persists one final provider outcome after a transient retry (recovers=%s)", async recovers => {
    writeConfig("arbeitnow:\n  enabled: true\n");
    const transportError = new TypeError("fetch failed", { cause: Object.assign(new Error("DNS"), { code: "EAI_AGAIN" }) });
    const fetcher = vi.fn().mockRejectedValueOnce(transportError);
    if (recovers) fetcher.mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    else fetcher.mockRejectedValue(transportError);
    const result = await runDiscovery("config/search.yaml", { arbeitnowFetcher: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.failures).toBe(recovers ? 0 : 1);
    expect(result.errors).toHaveLength(recovers ? 0 : 1);
    const row = db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 1").get() as Record<string, any>;
    expect(discoveryRunPresentation(row).status).toBe(recovers ? "Completed" : "Failed");
  });

  it.each([
    ["Bundesagentur", 'arbeitsagentur: all 8 keyword request(s) failed — "Engineer": fetch failed', true],
    ["Bundesagentur", 'arbeitsagentur: all 8 keyword request(s) failed — "Engineer": fetch failed', false],
    ["LinkedIn", "LinkedIn CLI: Error: getaddrinfo ENOTFOUND www.linkedin.com", true],
    ["LinkedIn", "LinkedIn CLI: Error: getaddrinfo ENOTFOUND www.linkedin.com", false]
  ] as const)("retries wrapped %s transport errors once (%s) and persists only the final outcome (recovers=%s)", async (provider, message, recovers) => {
    writeConfig(provider === "Bundesagentur" ? "bundesagentur:\n  enabled: true\n" : "linkedin:\n  enabled: true\n");
    const attempt = vi.fn(async () => {
      if (!recovers || attempt.mock.calls.length === 1) throw new Error(message);
      return [];
    });
    if (provider === "Bundesagentur") vi.spyOn(BundesagenturAdapter.prototype, "discover").mockImplementation(attempt);
    try {
      const result = await runDiscovery("config/search.yaml", provider === "LinkedIn" ? { linkedinRunner: async () => JSON.stringify({ results: await attempt() }) } : {});
      expect(attempt).toHaveBeenCalledTimes(2);
      expect(result.failures).toBe(recovers ? 0 : 1);
      expect(result.errors).toHaveLength(recovers ? 0 : 1);
      const row = db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 1").get() as Record<string, any>;
      expect(discoveryRunPresentation(row).status).toBe(recovers ? "Completed" : "Failed");
      expect(String(row.errors)).toBe(recovers ? "" : `${provider === "Bundesagentur" ? "Bundesagentur für Arbeit" : "LinkedIn"}: ${message}`);
    } finally { vi.restoreAllMocks(); }
  });

  it("keeps only unmatched errors alongside source outcomes, including repeated source names", () => {
    const run = completed("Workable, Workable", "Workable: HTTP 503\nPersonio configuration: invalid source");
    expect(discoverySourceOutcomes(run).filter(source => source.error).map(source => source.error)).toEqual(["HTTP 503"]);
    expect(discoveryUnmatchedErrors(run)).toEqual(["Personio configuration: invalid source"]);
    expect(discoveryUnmatchedErrors(completed("Workable", "Workable: HTTP 503"))).toEqual([]);
    expect(discoveryUnmatchedErrors(completed("", "Historical unprefixed error"))).toEqual(["Historical unprefixed error"]);
  });

  it.each([
    () => new Response("unavailable", { status: 503 }),
    () => new Response("{invalid json"),
    () => new Response(JSON.stringify({ data: "invalid schema" }))
  ])("does not retry HTTP, malformed JSON or invalid schema", async response => {
    writeConfig("arbeitnow:\n  enabled: true\n");
    const fetcher = vi.fn(async () => response());
    const result = await runDiscovery("config/search.yaml", { arbeitnowFetcher: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.failures).toBe(1);
  });

  it("does not count sources skipped after reaching the accepted-candidate limit", async () => {
    writeConfig("arbeitnow:\n  enabled: true\nlinkedin:\n  enabled: true\n", "limits:\n  perRun: 1\n");
    const linkedinRunner = vi.fn(async () => "[]");
    const result = await runDiscovery("config/search.yaml", {
      arbeitnowFetcher: async () => new Response(JSON.stringify({ data: [{ slug: "engineer", company_name: "Acme", title: "Engineer", location: "Berlin", url: "https://www.arbeitnow.com/jobs/engineer", description: "Build useful products", remote: false }] })),
      linkedinRunner
    });
    expect(result.newJobs).toBe(1);
    expect(linkedinRunner).not.toHaveBeenCalled();
    const row = db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 1").get() as Record<string, any>;
    expect(row.sources_attempted).toBe("Arbeitnow");
    expect(discoverySourceOutcomes(row)).toEqual([{ name: "Arbeitnow", status: "succeeded", error: undefined }]);
  });

  it("classifies structured causes narrowly, including cyclic causes", () => {
    for (const code of ["ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ECONNRESET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]) {
      expect(isTransientDiscoveryError(new Error("transport", { cause: { code } }))).toBe(true);
    }
    for (const error of [new Error("HTTP 429"), new Error("HTTP 503"), new Error("invalid configuration: fetch failed"), new Error("schema timeout"), new SyntaxError("fetch failed"), new Error("configuration: ENOTFOUND"), new Error("schema: ECONNRESET"), new Error("HTTP 503: ENOTFOUND"), new Error("LinkedIn CLI: invalid JSON ETIMEDOUT"), new Error("XENOTFOUNDX"), new Error('arbeitsagentur: all 8 keyword request(s) failed — "Engineer": invalid JSON'), new Error("arbitrary fetch failed")]) {
      expect(isTransientDiscoveryError(error)).toBe(false);
    }
    const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
    expect(isTransientDiscoveryError(cyclic)).toBe(false);
  });

  it("gives Web Search exactly two fetch attempts through the shared retry", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    try {
      await expect(discoverWithRetry(new WebSearchAdapter({ roleFamilies: ["Engineer"] }, {}))).rejects.toThrow("fetch failed");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
});
