"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const REQUIRED_IDS = [
  "stageCanvas",
  "videoBtn",
  "frameBtn",
  "framePairBtn",
  "timelineTrack",
  "cameraFrame",
  "cameraRigList",
  "batchReferenceVideoBtn",
];
const REQUIRED_WORKFLOW_SELECTORS = [
  ".frisframe-phase-nav",
  '[data-workflow-phase="setup"]',
  '[data-workflow-phase="motion"]',
  ".frisframe-view-dock #viewButtons",
  "#exportMenu.frisframe-primary-export",
  ".frisframe-export-advanced",
  ".frisframe-project-advanced",
];
const RETIRED_IDS = [
  "blockingPlanBtn",
  "blockingPlanPanelBtn",
  "backgroundSheetBtn",
  "backgroundSheetPanelBtn",
  "productionPackBtn",
  "productionPackPanelBtn",
  "multiCamPreviewBtn",
  "multiCamPreviewPanelBtn",
  "multiCamPreviewPanelBtnSecondary",
  "multiCamVideoBtn",
  "multiCamVideoPanelBtn",
  "spatialReferenceStatus",
  "spatialReferenceImageInput",
  "spatialReferencePreview",
  "clearSpatialReferenceBtn",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("원격 디버깅 포트를 확보하지 못했습니다."));
        else resolve(port);
      });
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`DevTools HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("DevTools HTTP timeout")));
    request.on("error", reject);
  });
}

async function waitForPage(port, child, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`FrisFrame가 GUI 검사 전에 종료되었습니다. (${child.exitCode})`);
    try {
      const pages = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = Array.isArray(pages)
        ? pages.find((entry) => entry?.type === "page" && entry.webSocketDebuggerUrl)
        : null;
      if (page) return page;
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`FrisFrame DevTools 페이지를 찾지 못했습니다.${lastError ? ` ${lastError.message}` : ""}`);
}

function openWebSocket(url) {
  if (typeof WebSocket !== "function") throw new Error("Node.js WebSocket API를 사용할 수 없습니다. Node 22 이상이 필요합니다.");
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      try { socket.close(); } catch { /* ignored */ }
      reject(new Error("DevTools WebSocket 연결 시간이 초과되었습니다."));
    }, 5000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("DevTools WebSocket 연결에 실패했습니다."));
    }, { once: true });
  });
}

let commandId = 0;
function cdp(socket, method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error(`${method} 응답 시간이 초과되었습니다.`));
    }, 5000);
    const onMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (payload.id !== id) return;
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      if (payload.error) reject(new Error(`${method}: ${payload.error.message || JSON.stringify(payload.error)}`));
      else resolve(payload.result || {});
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function readRendererState(socket) {
  const expression = `(() => {
    const required = ${JSON.stringify(REQUIRED_IDS)};
    const workflowSelectors = ${JSON.stringify(REQUIRED_WORKFLOW_SELECTORS)};
    const retired = ${JSON.stringify(RETIRED_IDS)};
    const debug = document.querySelector("#debugConsole");
    const phaseLabels = [...document.querySelectorAll(".frisframe-phase-nav button")].map((button) => String(button.textContent || "").trim());
    const exportLabel = String(document.querySelector("#exportMenu > summary span")?.textContent || "").trim();
    const videoLabel = String(document.querySelector("#videoBtn span")?.textContent || "").trim();
    return {
      readyState: document.readyState,
      title: document.title,
      url: location.href,
      requiredMissing: required.filter((id) => !document.getElementById(id)),
      workflowMissing: workflowSelectors.filter((selector) => !document.querySelector(selector)),
      retiredPresent: retired.filter((id) => document.getElementById(id)),
      phaseLabels,
      exportLabel,
      videoLabel,
      referenceWorkflowReady: Boolean(window.FrisFrameReferenceWorkflowCore),
      debugConsoleVisible: Boolean(debug && getComputedStyle(debug).display !== "none"),
      bodyText: String(document.body?.innerText || "").slice(0, 1800),
    };
  })()`;
  const result = await cdp(socket, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value || null;
}

async function waitForHealthyRenderer(socket, child, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`FrisFrame 렌더러 검사 중 앱이 종료되었습니다. (${child.exitCode})`);
    try {
      const state = await readRendererState(socket);
      if (state) {
        lastState = state;
        if (
          state.readyState === "complete" &&
          state.title === "FrisFrame" &&
          state.referenceWorkflowReady === true &&
          state.debugConsoleVisible === false &&
          Array.isArray(state.requiredMissing) && state.requiredMissing.length === 0 &&
          Array.isArray(state.workflowMissing) && state.workflowMissing.length === 0 &&
          Array.isArray(state.retiredPresent) && state.retiredPresent.length === 0 &&
          Array.isArray(state.phaseLabels) && state.phaseLabels.join("|") === "구성|움직임" &&
          state.exportLabel === "프리비즈 출력" &&
          state.videoLabel === "프리비즈 MP4 만들기"
        ) return state;
      }
    } catch {
      // The first renderer target can briefly reload while the local server boots.
    }
    await delay(250);
  }
  throw new Error(`패키지 GUI 계약이 준비되지 않았습니다. 마지막 상태: ${JSON.stringify(lastState)}`);
}

function waitForExit(child, timeoutMs = 10000) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("FrisFrame smoke 종료 시간이 초과되었습니다.")), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

function packagedExecutable() {
  if (process.platform === "win32") return path.join(root, "release", "win-unpacked", "FrisFrame.exe");
  if (process.platform === "darwin") return path.join(root, "release", "mac-arm64", "FrisFrame.app", "Contents", "MacOS", "FrisFrame");
  throw new Error(`패키지 GUI smoke를 지원하지 않는 플랫폼입니다: ${process.platform}`);
}

async function main() {
  const executable = packagedExecutable();
  if (!fs.existsSync(executable)) throw new Error(`FrisFrame 실행 파일이 없습니다: ${executable}`);
  const port = await reserveLoopbackPort();
  const output = [];
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
  ], {
    cwd: path.dirname(executable),
    env: {
      ...process.env,
      FRISFRAME_PACKAGE_SMOKE: "1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => output.push(String(chunk)));
  child.stderr?.on("data", (chunk) => output.push(String(chunk)));

  let socket = null;
  try {
    const page = await waitForPage(port, child);
    socket = await openWebSocket(page.webSocketDebuggerUrl);
    const state = await waitForHealthyRenderer(socket, child);
    await cdp(socket, "Runtime.evaluate", {
      expression: "setTimeout(() => window.close(), 50); 'closing'",
      returnByValue: true,
    });
    const code = await waitForExit(child);
    if (code !== 0) throw new Error(`FrisFrame가 GUI smoke 종료 중 오류 코드를 반환했습니다: ${code}`);
    console.log(`FrisFrame 패키지 GUI smoke 통과: ${state.url}`);
    console.log(`필수 UI ${REQUIRED_IDS.length}개 · 워크플로우 UI ${REQUIRED_WORKFLOW_SELECTORS.length}개 확인 · 폐기 UI ${RETIRED_IDS.length}개 부재 확인`);
  } catch (error) {
    try { socket?.close(); } catch { /* ignored */ }
    if (child.exitCode === null) child.kill();
    const diagnostics = output.join("").trim();
    throw new Error(`${error.message}${diagnostics ? `\n앱 출력:\n${diagnostics.slice(-5000)}` : ""}`);
  } finally {
    try { socket?.close(); } catch { /* ignored */ }
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});