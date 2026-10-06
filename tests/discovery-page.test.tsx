import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DiscoveryPage from "../app/discovery/page";
import { closeDb, db } from "../lib/db";

const folder = path.join(os.tmpdir(), `discovery-page-test-${process.pid}-${Math.random().toString(16).slice(2)}`);
const dbFile = path.join(folder, "data", "test.sqlite");
const oldRoot = process.env.JOB_AGENT_WORKSPACE_ROOT;
const oldDb = process.env.JOB_AGENT_DB_PATH;
beforeEach(() => {
  fs.mkdirSync(path.join(folder, "config"), { recursive: true });
  process.env.JOB_AGENT_WORKSPACE_ROOT = folder;
  process.env.JOB_AGENT_DB_PATH = dbFile;
  closeDb();
  db();
});
afterEach(() => {
  closeDb();
  if (oldRoot === undefined) delete process.env.JOB_AGENT_WORKSPACE_ROOT; else process.env.JOB_AGENT_WORKSPACE_ROOT = oldRoot;
  if (oldDb === undefined) delete process.env.JOB_AGENT_DB_PATH; else process.env.JOB_AGENT_DB_PATH = oldDb;
  fs.rmSync(folder, { recursive: true, force: true });
});

describe("Discovery page", () => {
  it("shows allowlisted live source config and persisted run history without config controls or writes", async () => {
    const configPath = path.join(folder, "config", "search.yaml");
    fs.writeFileSync(configPath, "arbeitnow:\n  enabled: true\n  limit: 50\n  token: never-render-this\nbundesagentur:\n  enabled: true\n  limit: 6\nwebSearch:\n  enabled: false\n");
    const before = fs.readFileSync(configPath, "utf8");
    db().prepare("INSERT INTO discovery_runs(ended_at,sources_attempted,jobs_seen,new_jobs,duplicates,failures,errors) VALUES(?,?,?,?,?,?,?)")
      .run("2026-10-06 12:00:00", "Bundesagentur für Arbeit, Arbeitnow", 4, 1, 2, 0, "");

    const html = renderToStaticMarkup(await DiscoveryPage());
    expect(html).toContain("Discovery Control Panel");
    expect(html).toContain("Arbeitnow");
    expect(html).toContain("Enabled");
    expect(html).toContain("Limit 50");
    expect(html).toContain("Succeeded in latest run");
    expect(html).toContain("Disabled");
    expect(html).toContain("1 new · 2 duplicates");
    expect(html).not.toContain("never-render-this");
    expect(html).not.toContain("type=\"checkbox\"");
    expect(html).not.toContain("type=\"number\"");
    expect(html).not.toContain("<select");
    expect(fs.readFileSync(configPath, "utf8")).toBe(before);
  });
});
