const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { isChildExited } = require("./lib/child-process.cjs");
const { isInternalUrl, loadWorkspacePath, prepareStandaloneRuntime, readWorkspacePath, saveWorkspacePath, validateWorkspace } = require("./lib/workspace.cjs");

function workspaceFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "job-search-agent-desktop-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "job-search-agent" }));
  fs.mkdirSync(path.join(root, "app"));
  fs.mkdirSync(path.join(root, "node_modules", "next"), { recursive: true });
  fs.mkdirSync(path.join(root, ".next", "standalone"), { recursive: true });
  fs.mkdirSync(path.join(root, ".next", "static"));
  fs.writeFileSync(path.join(root, "node_modules", "next", "package.json"), "{}");
  fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), "build");
  fs.writeFileSync(path.join(root, ".next", "standalone", "server.js"), "");
  return root;
}

test("validates and persists only a usable workspace path", (t) => {
  const workspace = workspaceFixture();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "job-search-agent-userdata-"));
  t.after(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(userData, { recursive: true, force: true });
  });

  assert.equal(validateWorkspace(workspace), null);
  saveWorkspacePath(userData, workspace);
  assert.equal(loadWorkspacePath(userData), workspace);
  assert.equal(readWorkspacePath(userData), workspace);
  fs.rmSync(path.join(workspace, ".next", "BUILD_ID"));
  assert.equal(loadWorkspacePath(userData), null);
  assert.equal(readWorkspacePath(userData), workspace);
});

test("prepares existing Next.js assets for its standalone server", (t) => {
  const workspace = workspaceFixture();
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.writeFileSync(path.join(workspace, ".next", "static", "asset.js"), "asset");
  prepareStandaloneRuntime(workspace);
  assert.equal(fs.readFileSync(path.join(workspace, ".next", "standalone", ".next", "static", "asset.js"), "utf8"), "asset");
});

test("distinguishes local app URLs from external URLs", () => {
  const origin = "http://127.0.0.1:43127";
  assert.equal(isInternalUrl(`${origin}/jobs/JOB-0001`, origin), true);
  assert.equal(isInternalUrl("https://employer.example/jobs/1", origin), false);
  assert.equal(isInternalUrl("http://127.0.0.1:43128/", origin), false);
});

test("recognizes child processes exited by code or signal", () => {
  assert.equal(isChildExited({ exitCode: null, signalCode: null }), false);
  assert.equal(isChildExited({ exitCode: 0, signalCode: null }), true);
  assert.equal(isChildExited({ exitCode: null, signalCode: "SIGTERM" }), true);
});
