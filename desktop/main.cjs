const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { isInternalUrl, prepareStandaloneRuntime, readWorkspacePath, saveWorkspacePath, validateWorkspace } = require("./lib/workspace.cjs");

app.setName("Job Search Agent");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow;
  let backend;
  let backendUrl;
  let workspacePath;
  let isQuitting = false;
  let changingWorkspace = false;

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  function availablePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        server.close((error) => error ? reject(error) : resolve(address.port));
      });
    });
  }

  function probe(url) {
    return new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(true);
      });
      request.setTimeout(1000, () => request.destroy());
      request.once("error", () => resolve(false));
    });
  }

  async function startBackend(root) {
    prepareStandaloneRuntime(root);
    const port = await availablePort();
    const origin = `http://127.0.0.1:${port}`;
    const stderr = [];
    const child = spawn("/bin/zsh", ["-lc", 'exec node "$@"', "job-search-agent", path.join(root, ".next", "standalone", "server.js")], {
      cwd: root,
      env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const state = { child, expectedStop: false, stderr };
    backend = state;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
      if (stderr.join("").length > 6000) stderr.splice(0, stderr.length - 1);
    });

    let spawnError;
    child.once("error", (error) => { spawnError = error; });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (spawnError) break;
      if (child.exitCode !== null) break;
      if (await probe(origin)) {
        backendUrl = origin;
        child.once("exit", (code, signal) => {
          if (state.expectedStop || isQuitting || backend !== state) return;
          backend = undefined;
          backendUrl = undefined;
          void dialog.showMessageBox({
            type: "error",
            title: "Job Search Agent stopped",
            message: "The local dashboard server stopped unexpectedly.",
            detail: `Exit: ${code ?? signal ?? "unknown"}`,
          }).then(() => app.quit());
        });
        return origin;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    state.expectedStop = true;
    await stopBackend(state);
    const detail = [spawnError?.message, stderr.join("").trim()].filter(Boolean).join("\n").slice(-1800);
    throw new Error(`The production server did not become ready within 45 seconds.${detail ? `\n\n${detail}` : ""}`);
  }

  async function stopBackend(state = backend) {
    if (!state || state.child.exitCode !== null) {
      if (backend === state) backend = undefined;
      return;
    }
    state.expectedStop = true;
    const child = state.child;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const stopped = await Promise.race([exited.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5000))]);
    if (!stopped) {
      child.kill("SIGKILL");
      await exited;
    }
    if (backend === state) backend = undefined;
  }

  async function chooseWorkspace(existingPath, forcePicker = false) {
    if (existingPath && !validateWorkspace(existingPath) && !forcePicker) return existingPath;
    if (existingPath) {
      await dialog.showMessageBox({
        type: "warning",
        title: "Workspace not found",
        message: "The local Job Search Agent workspace could not be found.",
        detail: "Select the project folder again to continue.",
      });
    }
    while (true) {
      const result = await dialog.showOpenDialog({
        title: "Select Job Search Agent workspace",
        buttonLabel: "Use Workspace",
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const selected = result.filePaths[0];
      const problem = validateWorkspace(selected);
      if (!problem) return selected;
      await dialog.showMessageBox({
        type: "error",
        title: "Invalid workspace",
        message: "The selected folder is not a ready Job Search Agent workspace.",
        detail: problem,
      });
    }
  }

  function installMenu() {
    const template = [
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Workspace",
        submenu: [{ label: "Change Workspace…", click: () => { void changeWorkspace(); } }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  function createWindow(origin) {
    const window = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 920,
      minHeight: 640,
      title: "Job Search Agent",
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    mainWindow = window;
    const allowedOrigin = origin;
    window.webContents.on("will-navigate", (event, url) => {
      if (isInternalUrl(url, allowedOrigin)) return;
      event.preventDefault();
      void shell.openExternal(url);
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isInternalUrl(url, allowedOrigin)) return { action: "allow" };
      void shell.openExternal(url);
      return { action: "deny" };
    });
    window.on("closed", () => {
      if (mainWindow === window) mainWindow = undefined;
    });
    void window.loadURL(origin);
  }

  async function launchWorkspace(root) {
    workspacePath = root;
    saveWorkspacePath(app.getPath("userData"), root);
    try {
      const origin = await startBackend(root);
      createWindow(origin);
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        title: "Could not start Job Search Agent",
        message: "The production dashboard server could not be started.",
        detail: error.message,
      });
      if (isQuitting) return;
      const choice = await dialog.showMessageBox({
        type: "question",
        title: "Workspace startup failed",
        message: "Choose another workspace or quit Job Search Agent.",
        buttons: ["Choose Workspace…", "Quit"],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice.response === 0) await changeWorkspace();
      else app.quit();
    }
  }

  async function changeWorkspace() {
    if (changingWorkspace || isQuitting) return;
    changingWorkspace = true;
    try {
      const selected = await chooseWorkspace(workspacePath, true);
      if (!selected || selected === workspacePath) return;
      mainWindow?.close();
      await stopBackend();
      await launchWorkspace(selected);
    } finally {
      changingWorkspace = false;
    }
  }

  app.on("before-quit", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    void stopBackend().finally(() => app.quit());
  });

  app.whenReady().then(async () => {
    installMenu();
    const selected = await chooseWorkspace(readWorkspacePath(app.getPath("userData")));
    if (!selected) {
      app.quit();
      return;
    }
    await launchWorkspace(selected);
  });

  app.on("activate", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (backendUrl) {
      createWindow(backendUrl);
    }
  });

  app.on("window-all-closed", () => {
    // Keep the local server alive while macOS hides the app after its last window closes.
  });
}
