import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverySourceConfig } from "../lib/discovery-config";

const folder = path.join(os.tmpdir(), `discovery-config-test-${process.pid}-${Math.random().toString(16).slice(2)}`);
beforeEach(() => fs.mkdirSync(folder, { recursive: true }));
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

describe("read-only Discovery config projection", () => {
  it("returns enabled state and only allowlisted source names and limits", () => {
    const file = path.join(folder, "search.yaml");
    fs.writeFileSync(file, `bundesagentur:\n  enabled: true\n  limit: 6\n  apiKey: secret-token\nwebSearch:\n  enabled: false\n  maxQueries: 99\nproviders:\n  - type: greenhouse\n    enabled: true\n    limit: 7\n    board: private-board\n  - type: unknown\n    enabled: true\n    secret: private\n`);

    const projection = discoverySourceConfig(file);
    expect(projection).toEqual({ available: true, sources: [
      { key: "bundesagentur", name: "Bundesagentur", outcomeName: "Bundesagentur für Arbeit", enabled: true, limit: 6 },
      { key: "webSearch", name: "Web Search", outcomeName: "Web search", enabled: false },
      { key: "provider-0", name: "Greenhouse", outcomeName: "Greenhouse", enabled: true, limit: 7 },
    ] });
    expect(JSON.stringify(projection)).not.toContain("secret");
    expect(JSON.stringify(projection)).not.toContain("private-board");
  });

  it("returns a harmless unavailable state for missing or invalid configuration", () => {
    expect(discoverySourceConfig(path.join(folder, "missing.yaml"))).toEqual({ available: false, sources: [] });
    const invalid = path.join(folder, "invalid.yaml");
    fs.writeFileSync(invalid, "[not: yaml");
    expect(discoverySourceConfig(invalid)).toEqual({ available: false, sources: [] });
  });
});
