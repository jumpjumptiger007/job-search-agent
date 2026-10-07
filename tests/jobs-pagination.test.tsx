import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobsPage from "../app/jobs/page";
import { closeDb } from "../lib/db";
import { ingest } from "../lib/jobs";
import { currentPageSelection, setCurrentPageSelection } from "../app/jobs/selection";
import { JOBS_PAGE_SIZE, jobsPageHref, paginateJobs } from "../app/jobs/pagination";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const dbFile = "/private/tmp/jobs-pagination.sqlite";
const store = "/private/tmp/jobs-pagination-store";
const oldDb = process.env.JOB_AGENT_DB_PATH;
const oldStore = process.env.JOB_AGENT_STORAGE_ROOT;

beforeEach(() => {
  closeDb();
  process.env.JOB_AGENT_DB_PATH = dbFile;
  process.env.JOB_AGENT_STORAGE_ROOT = store;
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(store, { recursive: true, force: true });
  fs.mkdirSync(path.join(store, "profile"), { recursive: true });
  fs.writeFileSync(path.join(store, "profile", "profile.yaml"), "name: Test Candidate\nskills: [TypeScript]\n");
});

afterEach(() => {
  closeDb();
  fs.rmSync(dbFile, { force: true });
  fs.rmSync(store, { recursive: true, force: true });
  if (oldDb === undefined) delete process.env.JOB_AGENT_DB_PATH; else process.env.JOB_AGENT_DB_PATH = oldDb;
  if (oldStore === undefined) delete process.env.JOB_AGENT_STORAGE_ROOT; else process.env.JOB_AGENT_STORAGE_ROOT = oldStore;
});

function addJobs(count: number) {
  return Array.from({ length: count }, (_, index) => ingest({
    company: "Acme & R&D",
    title: `Engineer ${String(index + 1).padStart(3, "0")}`,
    location: "Berlin",
    workModel: "Hybrid",
    url: `https://careers.example/role-${index + 1}`,
    sourceName: "Careers",
    description: "Senior TypeScript engineer role in Berlin.",
    contentStatus: "SUBSTANTIVE",
  }).job);
}

async function renderPage(params: { filter?: string; q?: string; page?: string }) {
  return renderToStaticMarkup(await JobsPage({ searchParams: Promise.resolve(params) }));
}

function renderedJobIds(html: string) {
  return [...html.matchAll(/aria-label="Select (JOB-\d+)"/g)].map((match) => match[1]);
}

function linkUrl(html: string, label: string) {
  const match = html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`));
  if (!match) throw new Error(`Could not find ${label} pagination link`);
  return new URL(match[1].replaceAll("&amp;", "&"), "http://localhost");
}

describe("Jobs pagination", () => {
  it("uses fixed pages and safely handles empty, boundary, malformed, and extreme page values", () => {
    const rows = Array.from({ length: 101 }, (_, index) => index + 1);
    expect(JOBS_PAGE_SIZE).toBe(50);
    expect(paginateJobs([])).toEqual({ rows: [], total: 0, page: 1, pageCount: 0 });
    expect(paginateJobs(rows.slice(0, 50)).rows).toHaveLength(50);
    expect(paginateJobs(rows.slice(0, 50)).pageCount).toBe(1);

    const first = paginateJobs(rows, "1");
    expect(first).toMatchObject({ total: 101, page: 1, pageCount: 3 });
    expect(first.rows).toHaveLength(50);
    expect(first.rows[0]).toBe(1);
    expect(first.rows.at(-1)).toBe(50);

    const second = paginateJobs(rows, "2");
    expect(second.rows).toHaveLength(50);
    expect(second.rows[0]).toBe(51);
    expect(second.rows.at(-1)).toBe(100);
    const last = paginateJobs(rows, "3");
    expect(last.rows).toEqual([101]);

    for (const invalid of [undefined, "", "0", "-1", "+2", "1.5", "abc", "2x", " 2 "]) {
      expect(paginateJobs(rows, invalid).page, `page ${String(invalid)}`).toBe(1);
    }
    expect(paginateJobs(rows, "999").page).toBe(3);
    expect(paginateJobs(rows, "9".repeat(400)).page).toBe(3);
  });

  it("keeps page-local selection reviewable and encodes pagination URLs", () => {
    expect(currentPageSelection(["JOB-0001", "JOB-0002", "JOB-0003"], ["JOB-0002", "JOB-0004"]))
      .toEqual(["JOB-0002"]);
    expect(setCurrentPageSelection(["JOB-0001"], ["JOB-0002", "JOB-0003"], true))
      .toEqual(["JOB-0002", "JOB-0003"]);
    expect(setCurrentPageSelection(["JOB-0001", "JOB-0002"], ["JOB-0002"], false))
      .toEqual([]);
    expect(jobsPageHref("review", "Acme & R&D Berlin", 2))
      .toBe("/jobs?filter=review&q=Acme+%26+R%26D+Berlin&page=2");
  });

  it("renders only the current filtered page, preserves query state, and clamps safely", async () => {
    const inserted = addJobs(51);
    const filter = "review";
    const query = "Acme & R&D";
    const first = await renderPage({ filter, q: query, page: "1" });
    const firstIds = renderedJobIds(first);
    expect(first).toContain("51 jobs");
    expect(first).toContain("Page 1 of 2");
    expect(firstIds).toHaveLength(50);
    expect(first).not.toContain("Previous</a>");
    expect(first).toContain('href="/jobs?filter=all"');
    expect(first).not.toContain('name="page"');
    expect(linkUrl(first, "Next").searchParams.get("filter")).toBe(filter);
    expect(linkUrl(first, "Next").searchParams.get("q")).toBe(query);
    expect(linkUrl(first, "Next").searchParams.get("page")).toBe("2");

    const second = await renderPage({ filter, q: query, page: "2" });
    const secondIds = renderedJobIds(second);
    expect(second).toContain("51 jobs");
    expect(second).toContain("Page 2 of 2");
    expect(secondIds).toHaveLength(1);
    expect(firstIds).not.toContain(secondIds[0]);
    expect(inserted.map((job) => job.job_id)).toContain(secondIds[0]);
    expect(linkUrl(second, "Previous").searchParams.get("page")).toBe("1");
    expect(linkUrl(second, "Previous").searchParams.get("filter")).toBe(filter);
    expect(linkUrl(second, "Previous").searchParams.get("q")).toBe(query);

    const clamped = await renderPage({ filter, q: query, page: "999" });
    expect(clamped).toContain("Page 2 of 2");
    expect(renderedJobIds(clamped)).toHaveLength(1);

    const malformed = await renderPage({ filter, q: query, page: "2x" });
    expect(malformed).toContain("Page 1 of 2");
    expect(renderedJobIds(malformed)).toHaveLength(50);
  });

  it("returns narrowed search results on page one without unnecessary controls", async () => {
    addJobs(51);
    const html = await renderPage({ filter: "review", q: "Engineer 001", page: "9" });
    expect(html).toContain("1 job");
    expect(html).not.toContain("jobs-pagination");
    expect(renderedJobIds(html)).toHaveLength(1);
  });
});
