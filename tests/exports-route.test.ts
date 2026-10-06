import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/export/route";
import { closeDb } from "../lib/db";
import { ingest } from "../lib/jobs";

const file = path.join("/private/tmp", "job-search-exports-route.sqlite");
beforeEach(() => { closeDb(); process.env.JOB_AGENT_DB_PATH = file; fs.rmSync(file, { force: true }); });
afterEach(() => { closeDb(); fs.rmSync(file, { force: true }); });

describe("existing export formats", () => {
  it("continues to return both current CSV and XLSX downloads", async () => {
    ingest({ company: "Acme", title: "Engineer", url: "https://careers.example/engineer", sourceName: "Careers", description: "Role details" });
    const csv = GET(new NextRequest("http://localhost/api/export?format=csv"));
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(csv.headers.get("content-disposition")).toContain("job-agent-export.csv");
    expect(await csv.text()).toContain("JOB-0001");

    const xlsx = GET(new NextRequest("http://localhost/api/export?format=xlsx"));
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(xlsx.headers.get("content-disposition")).toContain("job-agent-export.xlsx");
    expect((await xlsx.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });
});
