import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveBunExecutable } from "../lib/integrations/linkedin";

let temporary = "";
afterEach(() => { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); });

const executable = (file:string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(file, 0o755);
  return file;
};

describe("LinkedIn Bun executable resolution", () => {
  it("prefers BUN_BIN when explicitly set", () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-bun-override-"));
    const override = executable(path.join(temporary, "custom", "bun"));
    expect(resolveBunExecutable({ BUN_BIN: override, PATH: "/missing" }, temporary)).toBe(override);
  });

  it("uses Bun from PATH for normal shell and CLI environments", () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-bun-path-"));
    const fromPath = executable(path.join(temporary, "bin", "bun"));
    expect(resolveBunExecutable({ PATH: path.dirname(fromPath) }, path.join(temporary, "home"))).toBe(fromPath);
  });

  it("finds the standard per-user Bun installation when PATH omits it", () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-bun-home-"));
    const homeInstall = executable(path.join(temporary, "home", ".bun", "bin", "bun"));
    expect(resolveBunExecutable({ PATH: path.join(temporary, "system-bin") }, path.join(temporary, "home"))).toBe(homeInstall);
  });

  it("leaves the bun command intact when no installation is found", () => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-bun-missing-"));
    expect(resolveBunExecutable({ PATH: path.join(temporary, "empty-bin") }, path.join(temporary, "home"))).toBe("bun");
  });
});
