const fs = require("node:fs");
const path = require("node:path");
const loopbackHosts = new Set(["127.0.0.1", "localhost"]);

function validateWorkspace(workspacePath) {
  try {
    const root = path.resolve(workspacePath);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (manifest.name !== "job-search-agent") return "package.json is not the Job Search Agent project.";
    if (!fs.statSync(path.join(root, "app")).isDirectory()) return "The Next.js app directory is missing.";
    if (!fs.existsSync(path.join(root, "node_modules", "next", "package.json"))) return "The project dependencies are not installed.";
    if (!fs.existsSync(path.join(root, ".next", "BUILD_ID")) || !fs.existsSync(path.join(root, ".next", "standalone", "server.js")) || !fs.statSync(path.join(root, ".next", "static")).isDirectory()) {
      return "The production build is missing. Run npm run build in the workspace first.";
    }
    return null;
  } catch {
    return "The local Job Search Agent workspace could not be found or read.";
  }
}

function prepareStandaloneRuntime(workspacePath) {
  const root = path.resolve(workspacePath);
  const standalone = path.join(root, ".next", "standalone");
  fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true, force: true });
  const publicPath = path.join(root, "public");
  if (fs.existsSync(publicPath)) fs.cpSync(publicPath, path.join(standalone, "public"), { recursive: true, force: true });
}

function workspacePathFile(userDataPath) {
  return path.join(userDataPath, "workspace-path");
}

function loadWorkspacePath(userDataPath) {
  try {
    const workspacePath = readWorkspacePath(userDataPath);
    return workspacePath && !validateWorkspace(workspacePath) ? workspacePath : null;
  } catch {
    return null;
  }
}

function readWorkspacePath(userDataPath) {
  try {
    const workspacePath = fs.readFileSync(workspacePathFile(userDataPath), "utf8").trim();
    return workspacePath ? path.resolve(workspacePath) : null;
  } catch {
    return null;
  }
}

function saveWorkspacePath(userDataPath, workspacePath) {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(workspacePathFile(userDataPath), path.resolve(workspacePath), "utf8");
}

function isInternalUrl(candidate, localOrigin) {
  try {
    const url = new URL(candidate);
    const backend = new URL(localOrigin);
    return url.protocol === "http:" && backend.protocol === "http:" && url.port === backend.port && (url.hostname === backend.hostname || loopbackHosts.has(url.hostname) && loopbackHosts.has(backend.hostname));
  } catch {
    return false;
  }
}

module.exports = { isInternalUrl, loadWorkspacePath, prepareStandaloneRuntime, readWorkspacePath, saveWorkspacePath, validateWorkspace };
