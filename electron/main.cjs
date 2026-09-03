"use strict";

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, session } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const readline = require("node:readline");
const { registerClipboardImageHandler } = require("./clipboard.cjs");
const { registerFileSaveHandler } = require("./file-save.cjs");
const { createPhoneRemoteBridge } = require("./phone-remote.cjs");
const { createPhoneMotionBridge } = require("./phone-motion-server.cjs");

app.setName("FrisFrame");

let mainWindow = null;
let serverProcess = null;
let serverOrigin = "";
let quitting = false;
let logFile = "";
let phoneRemoteBridge = null;
let phoneMotionBridge = null;

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

registerFileSaveHandler({
  ipcMain,
  dialog,
  getAllowedOrigin: () => serverOrigin,
  getDefaultDirectory: () => app.getPath("downloads"),
  getOwnerWindow: (sender) => BrowserWindow.fromWebContents(sender),
});

function packagedRuntimePath(filename) {
  return path.join(process.resourcesPath, "runtime", filename);
}

function resolveServerLaunch() {
  if (app.isPackaged) {
    const serverName = process.platform === "win32" ? "frisframe-server.exe" : "frisframe-server";
    const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    return {
      command: packagedRuntimePath(path.join("server", serverName)),
      args: [],
      ffmpeg: packagedRuntimePath(ffmpegName),
    };
  }
  return {
    command: process.env.FRISFRAME_PYTHON || (process.platform === "win32" ? "python" : "python3.11"),
    args: [path.join(app.getAppPath(), "server.py")],
    ffmpeg: require("ffmpeg-static"),
  };
}

function resolveMcpLaunch() {
  if (app.isPackaged) {
    const mcpName = process.platform === "win32" ? "frisframe-mcp.exe" : "frisframe-mcp";
    return {
      command: packagedRuntimePath(path.join("mcp", mcpName)),
      args: [],
    };
  }
  return {
    command: process.env.FRISFRAME_PYTHON || (process.platform === "win32" ? "python" : "python3.11"),
    args: [path.join(app.getAppPath(), "mcp_desktop_entry.py")],
  };
}

function copyMcpLaunchPath() {
  const launch = resolveMcpLaunch();
  if (app.isPackaged && !fs.existsSync(launch.command)) {
    throw new Error(`MCP 실행 파일을 찾을 수 없습니다: ${launch.command}`);
  }
  clipboard.writeText(launch.command);
  const detail = launch.args.length
    ? `command: ${launch.command}\nargs: ${launch.args.join(" ")}`
    : launch.command;
  dialog.showMessageBox({
    type: "info",
    title: "FrisFrame MCP",
    message: "MCP 실행 경로를 클립보드에 복사했습니다.",
    detail: `${detail}\n\n외부 MCP 클라이언트의 stdio 서버 command에 이 경로를 등록하세요.`,
    buttons: ["확인"],
  }).catch((error) => writeLog(`MCP path dialog failed: ${error.stack || error}`));
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
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    if (result.status !== 0) {
      try { child.kill(); } catch { /* Process already ended. */ }
    }
    return;
  }
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
  if (app.isPackaged && process.platform !== "win32") {
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
    detached: process.platform !== "win32",
    windowsHide: true,
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
  app.setAboutPanelOptions({
    applicationName: "FrisFrame",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: "Copyright (c) 2026 Egoist Film",
    credits: "Egoist Film",
  });
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
    {
      label: "도움말",
      submenu: [
        {
          label: "MCP 실행 경로 복사",
          click: () => {
            try {
              copyMcpLaunchPath();
            } catch (error) {
              writeLog(`MCP path copy failed: ${error.stack || error}`);
              dialog.showErrorBox("FrisFrame MCP", error.message || String(error));
            }
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function rendererUrlMatchesOrigin(value, allowedOrigin) {
  if (!allowedOrigin) return false;
  try {
    return new URL(value).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function rendererEventAllowed(event) {
  const value = event?.senderFrame?.url || event?.sender?.getURL?.() || "";
  return rendererUrlMatchesOrigin(value, serverOrigin);
}

function combinedPhoneRemoteConfig() {
  const remote = phoneRemoteBridge?.getConfig?.() || null;
  if (!remote) return null;
  return { ...remote, motion:phoneMotionBridge?.getConfig?.() || null };
}

ipcMain.handle("phone-remote:start", async (event) => {
  if (!rendererEventAllowed(event)) throw new Error("Phone Camera Remote 요청 출처가 올바르지 않습니다.");
  if (!phoneRemoteBridge) throw new Error("Phone Camera Remote가 준비되지 않았습니다.");
  const remote = await phoneRemoteBridge.start();
  if (phoneMotionBridge) {
    try { await phoneMotionBridge.start(); }
    catch (error) { writeLog(`phone physical camera start failed: ${error.stack || error}`); }
  }
  return { ...remote, motion:phoneMotionBridge?.getConfig?.() || null };
});
ipcMain.handle("phone-remote:stop", async (event) => {
  if (!rendererEventAllowed(event)) throw new Error("Phone Camera Remote 요청 출처가 올바르지 않습니다.");
  phoneRemoteBridge?.stop?.();
  phoneMotionBridge?.stop?.();
  return true;
});
ipcMain.handle("phone-remote:status", async (event) => {
  if (!rendererEventAllowed(event)) throw new Error("Phone Camera Remote 요청 출처가 올바르지 않습니다.");
  return combinedPhoneRemoteConfig();
});

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
  const preventExternalNavigation = (event, url) => {
    if (!rendererUrlMatchesOrigin(url, origin)) event.preventDefault();
  };
  window.webContents.on("will-navigate", preventExternalNavigation);
  window.webContents.on("will-redirect", preventExternalNavigation);
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_event, details) => writeLog(`renderer exited: ${JSON.stringify(details)}`));
  window.webContents.on("did-finish-load", () => {
    for (const filename of ["workspace-ux.js", "hud-export-ux.js", "interaction-ux.js", "camera-operator-live-ux.js", "camera-operator-inputs-ux.js", "phone-motion-core.js", "phone-motion-camera-ux.js", "selection-ux.js", "alignment-ux.js", "history-safety-ux.js", "scene-cache-ux.js", "dynamic-prop-cache-ux.js", "stage-shell-cache-ux.js", "camera-path-cache-ux.js", "helper-raycast-ux.js", "preview-cache-ux.js", "performance-ux.js"]) {
      const uxPath = path.join(__dirname, filename);
      try {
        const source = fs.readFileSync(uxPath, "utf8");
        window.webContents.executeJavaScript(source, true).catch((error) => writeLog(`${filename} injection failed: ${error.stack || error}`));
      } catch (error) {
        writeLog(`${filename} file failed: ${error.stack || error}`);
      }
    }
  });
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
    session.defaultSession.registerPreloadScript({
      type: "frame",
      id: "frisframe-phone-remote",
      filePath: path.join(__dirname, "phone-remote-preload.cjs"),
    });
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setDevicePermissionHandler?.(() => false);
    try {
      const origin = await startLocalServer();
      phoneRemoteBridge = createPhoneRemoteBridge({ getWindow: () => mainWindow, writeLog });
      phoneMotionBridge = createPhoneMotionBridge({
        getWindow:() => mainWindow,
        writeLog,
        tlsDirectory:path.join(app.getPath("userData"), "phone-motion-tls"),
      });
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
    phoneRemoteBridge?.stop?.();
    phoneRemoteBridge = null;
    phoneMotionBridge?.stop?.();
    phoneMotionBridge = null;
    killServerProcess();
  });
}