"use strict";

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, session } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const readline = require("node:readline");
const { registerClipboardImageHandler } = require("./clipboard.cjs");

app.setName("FrisFrame");

let mainWindow = null;
let serverProcess = null;
let serverOrigin = "";
let quitting = false;
let logFile = "";

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${String(message).trim()}\n`;
  try {
    if (logFile) fs.appendFileSync(logFile, line, "utf8");
  } catch {
    // Logging must never prevent the editor from opening.
  }
  if (!app.isPackaged) process.stdout.write(line);
}

registerClipboardImageHandler({
  ipcMain,
  clipboard,
  nativeImage,
  getAllowedOrigin: () => serverOrigin,
});

function packagedRuntimePath(filename) {
  return path.join(process.resourcesPath, "runtime", filename);
}

function resolveServerLaunch() {
  if (app.isPackaged) {
    return {
      command: packagedRuntimePath(path.join("server", "frisframe-server")),
      args: [],
      ffmpeg: packagedRuntimePath("ffmpeg"),
    };
  }
  return {
    command: process.env.FRISFRAME_PYTHON || "python3.11",
    args: [path.join(app.getAppPath(), "server.py")],
    ffmpeg: require("ffmpeg-static"),
  };
}

function ensureUserDataDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (fs.existsSync(databasePath) || app.isPackaged) return;
  const legacyPath = path.join(app.getAppPath(), "previs_projects.db");
  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, databasePath, fs.constants.COPYFILE_EXCL);
    writeLog(`기존 프로젝트 DB를 사용자 데이터 폴더로 복사했습니다: ${databasePath}`);
  }
}

function readRuntimeState(statePath) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const port = Number(state.port);
    return Number.isInteger(port) && port >= 1024 && port <= 65535 ? { port } : {};
  } catch {
    return {};
  }
}

function writeRuntimeState(statePath, port) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ port, updatedAt: new Date().toISOString() }, null, 2), "utf8");
  fs.renameSync(temporary, statePath);
}

function waitForServer(origin, child, nonce, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (!child || child.exitCode !== null) {
        reject(new Error("FrisFrame 로컬 서버가 준비 전에 종료되었습니다."));
        return;
      }
      const request = http.get(`${origin}/api/health`, { timeout: 1200 }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (response.statusCode === 200 && body.app === "FrisFrame" && body.nonce === nonce) {
              resolve();
              return;
            }
          } catch {
            // A different local service must never be treated as FrisFrame.
          }
          retry();
        });
      });
      request.on("timeout", () => request.destroy());
      request.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("FrisFrame 로컬 서버 시작 시간이 초과되었습니다."));
        return;
      }
      setTimeout(attempt, 180);
    };
    attempt();
  });
}

function killServerProcess() {
  const child = serverProcess;
  serverProcess = null;
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch { return; }
  }
  setTimeout(() => {
    if (child.exitCode !== null) return;
    try { process.kill(-child.pid, "SIGKILL"); } catch {
      try { child.kill("SIGKILL"); } catch { /* Process already ended. */ }
    }
  }, 2500).unref();
}

async function startLocalServer() {
  const launch = resolveServerLaunch();
  const databasePath = path.join(app.getPath("userData"), "data", "frisframe.db");
  const runtimeStatePath = path.join(app.getPath("userData"), "state", "runtime.json");
  const persistedPort = readRuntimeState(runtimeStatePath).port || 0;
  const nonce = require("node:crypto").randomBytes(24).toString("hex");
  ensureUserDataDatabase(databasePath);
  [launch.command, launch.ffmpeg].forEach((runtimePath) => {
    if (path.isAbsolute(runtimePath) && !fs.existsSync(runtimePath)) {
      throw new Error(`필수 실행 파일을 찾을 수 없습니다: ${runtimePath}`);
    }
  });
  if (app.isPackaged) {
    fs.chmodSync(launch.command, 0o755);
    fs.chmodSync(launch.ffmpeg, 0o755);
  }
  const args = [...launch.args, "--host", "127.0.0.1", "--port", String(persistedPort)];
  const environment = {
    ...process.env,
    ENABLE_LICENSE_CHECK: "false",
    FRISFRAME_REQUIRE_ORIGIN: "true",
    FRISFRAME_SECURE_COOKIES: "false",
    FRISFRAME_FFMPEG: launch.ffmpeg,
    FRISFRAME_PARENT_PID: String(process.pid),
    FRISFRAME_STARTUP_NONCE: nonce,
    FRISFRAME_VERSION: app.getVersion(),
    PREVIS_DB_PATH: databasePath,
    PYTHONUNBUFFERED: "1",
  };
  serverProcess = spawn(launch.command, args, {
    cwd: app.getPath("userData"),
    env: environment,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const child = serverProcess;
  const ready = new Promise((resolve, reject) => {
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      writeLog(`server: ${line}`);
      if (!line.startsWith("FRISFRAME_READY ")) return;
      try {
        const payload = JSON.parse(line.slice("FRISFRAME_READY ".length));
        if (!Number.isInteger(payload.port) || payload.port < 1) throw new Error("서버 포트가 올바르지 않습니다.");
        resolve(payload);
      } catch (error) {
        reject(error);
      }
    });
    child.once("exit", (code) => reject(new Error(`FrisFrame 로컬 서버가 준비 전에 종료되었습니다. (${code})`)));
  });
  child.stderr.on("data", (chunk) => writeLog(`server error: ${chunk}`));
  child.once("error", (error) => writeLog(`server spawn failed: ${error.stack || error}`));
  child.once("exit", (code, signal) => {
    writeLog(`server exited code=${code} signal=${signal}`);
    if (serverProcess === child) serverProcess = null;
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("FrisFrame 서버 종료", "로컬 프로젝트 서버가 예기치 않게 종료되었습니다. 앱을 다시 실행해 주세요.");
    }
  });
  const readyPayload = await Promise.race([
    ready,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("FrisFrame 로컬 서버 시작 시간이 초과되었습니다.")), 30000)),
  ]);
  if (persistedPort && readyPayload.port !== persistedPort) throw new Error("저장된 로컬 포트와 다른 서버가 시작되었습니다.");
  writeRuntimeState(runtimeStatePath, readyPayload.port);
  serverOrigin = `http://127.0.0.1:${readyPayload.port}`;
  await waitForServer(serverOrigin, child, nonce);
  return serverOrigin;
}

function buildApplicationMenu() {
  const template = [
    {
      label: "FrisFrame",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { label: "편집", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "보기", submenu: [{ role: "reload" }, { role: "togglefullscreen" }] },
    { label: "창", submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow(origin) {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0b0f12",
    show: false,
    title: "FrisFrame",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow = window;
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${origin}/`)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_event, details) => writeLog(`renderer exited: ${JSON.stringify(details)}`));
  window.loadURL(`${origin}/`);
  return window;
}

async function showStartupFailure(error) {
  writeLog(error.stack || error);
  const window = new BrowserWindow({
    width: 700,
    height: 470,
    resizable: false,
    backgroundColor: "#0b0f12",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow = window;
  await window.loadFile(path.join(__dirname, "startup.html"), { query: { message: error.message } });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    logFile = path.join(app.getPath("userData"), "logs", "main.log");
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    buildApplicationMenu();
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    try {
      const origin = await startLocalServer();
      createMainWindow(origin);
    } catch (error) {
      await showStartupFailure(error);
    }
  });
  app.on("activate", () => {
    if (!mainWindow && serverOrigin) createMainWindow(serverOrigin);
  });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    quitting = true;
    killServerProcess();
  });
}
