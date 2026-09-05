"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");

const MAX_BODY_BYTES = 8192;
const MAX_PREVIEW_BYTES = 700 * 1024;
const DISPATCH_INTERVAL_MS = 32;
const PREVIEW_POLL_INTERVAL_MS = 50;

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function privateIpv4Addresses() {
  const found = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const address = String(entry.address || "");
      if (!address) continue;
      if (
        address.startsWith("10.")
        || address.startsWith("192.168.")
        || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
      ) found.push(address);
    }
  }
  return [...new Set(found)];
}

function sanitizeInput(payload = {}) {
  const command = ["", "toggle-record", "stop", "cancel", "motion-zero"].includes(String(payload.command || ""))
    ? String(payload.command || "")
    : "";
  return {
    seq: Math.max(0, Math.floor(Number(payload.seq) || 0)),
    sentAt: Number(payload.sentAt) || Date.now(),
    moveX: clamp(payload.moveX, -1, 1),
    moveY: clamp(payload.moveY, -1, 1),
    lookX: clamp(payload.lookX, -1, 1),
    lookY: clamp(payload.lookY, -1, 1),
    height: clamp(payload.height, -1, 1),
    focal: clamp(payload.focal, -1, 1),
    motionActive: payload.motionActive === true,
    sensorYaw: clamp(payload.sensorYaw, -180, 180),
    sensorPitch: clamp(payload.sensorPitch, -180, 180),
    sensorRoll: clamp(payload.sensorRoll, -180, 180),
    axisSwap: payload.axisSwap === true,
    command,
  };
}

function controllerHtml(token) {
  const safeToken = JSON.stringify(token);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta name="theme-color" content="#0b0f12" />
<title>FrisFrame Camera Remote</title>
<style>
:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b0f12;color:#eef2f7}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{margin:0;min-height:100vh;overscroll-behavior:none;background:radial-gradient(circle at 50% 10%,#18212a,#0b0f12 52%);touch-action:none}
.app{min-height:100vh;display:grid;grid-template-rows:auto auto auto 1fr auto;gap:12px;padding:14px;max-width:820px;margin:auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{font-weight:900;letter-spacing:.02em}.pill{padding:6px 9px;border:1px solid #2b3742;border-radius:999px;font-size:12px;color:#aeb8c2;background:#111820}.pill.ok{color:#a8f0bf;border-color:#315c3e}.pill.warn{color:#ffd18a;border-color:#614a28}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}button{min-height:46px;border:1px solid #34404b;border-radius:10px;background:#161d24;color:#edf2f6;font-weight:850;font-size:14px}button:active,button.on{background:#27333e;border-color:#6f879c}.rec{border-color:#713a3a;color:#ffd3d3}.stop{border-color:#5e4c2e;color:#ffe1aa}.motion-tools{display:grid;grid-template-columns:1.35fr .65fr;gap:8px;margin:12px 0 8px}.motion{border-color:#3d6c67;color:#b8eee3}.zero{border-color:#59614c;color:#e0edb7}.zero:disabled{opacity:.42}
.viewfinder{display:grid;gap:6px;min-width:0}.viewfinder-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#aeb9c4;font-size:11px;font-weight:850}.viewfinder-state{color:#7fdbca;font-size:10px;font-weight:700}.viewfinder-screen{position:relative;overflow:hidden;min-height:170px;aspect-ratio:16/9;border:1px solid #405363;border-radius:12px;background:#101820;box-shadow:inset 0 0 0 1px #0008,0 8px 24px #0005}.viewfinder-screen img{display:block;width:100%;height:100%;object-fit:contain;background:#101820}.viewfinder-screen:after{content:"";position:absolute;inset:10%;border:1px solid #bfe8d522;pointer-events:none}.viewfinder-grid{position:absolute;inset:0;background:linear-gradient(90deg,transparent 49.8%,#bfe8d51c 50%,transparent 50.2%),linear-gradient(0deg,transparent 49.8%,#bfe8d51c 50%,transparent 50.2%);pointer-events:none}.viewfinder-empty{position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;color:#778590;font-size:11px;line-height:1.4;pointer-events:none}
.shoulders{display:grid;grid-template-columns:1fr 1fr;gap:8px}.shoulders button{min-height:42px}.l1{border-color:#455873;color:#c9ddff}.r1{border-color:#6d4e39;color:#ffd3ad}.controls{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center}.padWrap{display:grid;gap:8px;place-items:center}.label{font-size:12px;color:#8f9aa5;font-weight:800;text-align:center}.pad{position:relative;width:min(42vw,260px);aspect-ratio:1;border:1px solid #34414c;border-radius:50%;background:radial-gradient(circle,#18222b 0 22%,#111820 23% 52%,#0e141a 53%);box-shadow:inset 0 0 28px #0008}.stick{position:absolute;width:34%;aspect-ratio:1;border-radius:50%;left:33%;top:33%;background:radial-gradient(circle at 35% 30%,#596775,#28333d 62%,#1a222a);border:1px solid #758391;box-shadow:0 8px 22px #0008;transform:translate(0,0)}
.trim{display:grid;grid-template-columns:1fr 1fr;gap:8px}.trim button{min-height:40px;font-size:12px}.footer{font-size:10px;color:#65717c;text-align:center;line-height:1.45}
@media(max-width:560px){.app{padding:10px;gap:9px}.actions{grid-template-columns:1fr 1fr}.controls{gap:8px}.pad{width:min(44vw,230px)}.viewfinder-screen{min-height:140px}}
</style>
</head>
<body>
<div class="app">
  <div class="top"><div class="brand">FrisFrame · PHONE CAMERA</div><div id="status" class="pill">연결 중</div></div>
  <div class="viewfinder" aria-label="PC 3D 카메라 프리뷰">
    <div class="viewfinder-bar"><span>PC 3D CAMERA VIEW</span><span id="previewState" class="viewfinder-state">프리뷰 대기</span></div>
    <div class="viewfinder-screen"><img id="previewImage" alt="PC 카메라 프리뷰" /><div class="viewfinder-empty" id="previewEmpty">PC 앱에서 폰 모드를 켜면<br />동기화된 카메라 화면이 표시됩니다.</div><div class="viewfinder-grid" aria-hidden="true"></div></div>
  </div>
  <div class="actions">
    <button id="recBtn" class="rec">● REC</button><button id="stopBtn" class="stop">■ STOP</button>
  </div>
  <div class="shoulders">
    <button id="l1Btn" class="l1">L1 · 높이 낮춤</button><button id="r1Btn" class="r1">R1 · 높이 높임</button>
  </div>
  <div class="controls">
    <div class="padWrap"><div class="label">왼쪽 조이스틱 · 무빙 / Truck · Dolly</div><div id="movePad" class="pad"><div class="stick"></div></div></div>
    <div class="padWrap"><div class="label">오른쪽 조이스틱 · 앵글 / Pan · Tilt</div><div id="lookPad" class="pad"><div class="stick"></div></div></div>
  </div>
  <div>
    <div class="trim"><button id="downBtn">▼ 카메라 낮춤</button><button id="upBtn">▲ 카메라 높임</button><button id="wideBtn">− Wide</button><button id="teleBtn">＋ Tele</button></div>
    <div class="motion-tools"><button id="motionBtn" class="motion">📱 모션 앵글 시작</button><button id="zeroBtn" class="zero" disabled>↺ 기준점</button></div>
    <div class="footer">같은 Wi‑Fi에서 사용하세요. 조이스틱은 무빙, 폰 모션은 앵글 동기화입니다. 모션은 버튼을 누른 뒤 허용하고 기준점을 잡으세요.</div>
  </div>
</div>
<script>
(() => {
  "use strict";
  const token = ${safeToken};
  const PREVIEW_POLL_INTERVAL_MS = ${PREVIEW_POLL_INTERVAL_MS};
  const state = { moveX:0,moveY:0,lookX:0,lookY:0,height:0,focal:0,motionActive:false,sensorYaw:0,sensorPitch:0,sensorRoll:0,axisSwap:false,command:"",seq:0 };
  const status = document.getElementById("status");
  const previewImage = document.getElementById("previewImage");
  const previewState = document.getElementById("previewState");
  const previewEmpty = document.getElementById("previewEmpty");
  const motionButton = document.getElementById("motionBtn");
  const zeroButton = document.getElementById("zeroBtn");
  let motionListenerInstalled = false;
  let motionRequested = false;
  let sendBusy = false;
  let lastOrientationAt = 0;
  let motionAxisMode = "";
  let previewBusy = false;
  let previewObjectUrl = "";
  const setStatus = (text, kind="") => { status.textContent=text; status.className="pill"+(kind?" "+kind:""); };
  const setPreviewState = (text, ready=false) => {
    previewState.textContent = text;
    previewState.style.color = ready ? "#7fdbca" : "#aeb9c4";
  };

  async function refreshPreview() {
    if (previewBusy) return;
    previewBusy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch("/preview?token=" + encodeURIComponent(token), { cache:"no-store", signal:controller.signal });
      if (response.status === 204) {
        setPreviewState("프리뷰 대기");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      if (!blob.size) throw new Error("empty-preview");
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(blob);
      previewImage.src = previewObjectUrl;
      previewEmpty.hidden = true;
      setPreviewState("PC 프리뷰 동기화", true);
    } catch {
      setPreviewState("PC 프리뷰 연결 대기");
    } finally {
      clearTimeout(timeout);
      previewBusy = false;
    }
  }

  const finite = (value, fallback=0) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
  const signedAngle = (value) => {
    const normalized = ((finite(value) % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
  };

  function handleOrientation(event) {
    if (!motionRequested || document.hidden) return;
    const alpha = finite(event?.alpha, NaN);
    const beta = finite(event?.beta, NaN);
    const gamma = finite(event?.gamma, NaN);
    if (![alpha, beta, gamma].every(Number.isFinite)) return;
    // alpha is useful when the phone is flat, while gamma is the useful
    // left/right rotation when the phone is held upright as a viewfinder.
    // Combining them keeps both common grips responsive without asking the
    // operator to switch a hidden axis setting.
    if (!motionAxisMode) motionAxisMode = Math.abs(beta) > 45 && Math.abs(beta) < 135 ? "upright" : "flat";
    state.sensorYaw = signedAngle(alpha + gamma);
    state.sensorPitch = Math.max(-180, Math.min(180, beta));
    state.sensorRoll = Math.max(-180, Math.min(180, gamma));
    state.motionActive = true;
    lastOrientationAt = Date.now();
    zeroButton.disabled = false;
    motionButton.textContent = "■ 모션 앵글 중지";
    setStatus("모션 연결됨", "ok");
  }

  async function enableMotion() {
    try {
      if (!window.isSecureContext) throw new Error("센서 조작은 PC의 Physical Camera 보안 연결에서 시작하세요. 여기서는 조이스틱을 사용할 수 있습니다.");
      if (!("DeviceOrientationEvent" in window)) throw new Error("이 폰 브라우저가 기기 방향 센서를 지원하지 않습니다.");
      motionAxisMode = "";
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw new Error("기기 방향 센서 권한이 허용되지 않았습니다.");
      }
      if (!motionListenerInstalled) {
        window.addEventListener("deviceorientation", handleOrientation, { passive:true });
        window.addEventListener("deviceorientationabsolute", handleOrientation, { passive:true });
        motionListenerInstalled = true;
      }
      motionRequested = true;
      lastOrientationAt = Date.now();
      state.motionActive = false;
      state.command = "motion-zero";
      motionButton.textContent = "■ 모션 앵글 중지";
      setStatus("모션 기준점 대기", "warn");
    } catch (error) {
      motionRequested = false;
      state.motionActive = false;
      setStatus(String(error?.message || error), "warn");
    }
  }

  function disableMotion() {
    motionRequested = false;
    state.motionActive = false;
    state.command = "motion-zero";
    motionAxisMode = "";
    zeroButton.disabled = true;
    motionButton.textContent = "📱 모션 앵글 시작";
    setStatus("조이스틱 운용 가능", "");
  }

  function setupPad(root, onValue) {
    const stick = root.querySelector(".stick");
    let pointer = null;
    function apply(event) {
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      let x = (event.clientX-cx)/(rect.width*.36), y=(event.clientY-cy)/(rect.height*.36);
      const length = Math.hypot(x,y); if(length>1){x/=length;y/=length;}
      stick.style.transform = "translate(" + (x*75) + "%," + (y*75) + "%)"; onValue(x,y);
    }
    root.addEventListener("pointerdown", e=>{pointer=e.pointerId;root.setPointerCapture?.(pointer);apply(e);});
    root.addEventListener("pointermove", e=>{if(e.pointerId===pointer)apply(e);});
    const release=e=>{if(pointer!==null && (e.pointerId==null||e.pointerId===pointer)){pointer=null;stick.style.transform="translate(0,0)";onValue(0,0);}};
    root.addEventListener("pointerup",release);root.addEventListener("pointercancel",release);
    root.addEventListener("lostpointercapture",release);
    window.addEventListener("blur",release);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)release({});});
  }
  setupPad(document.getElementById("movePad"),(x,y)=>{state.moveX=x;state.moveY=-y;});
  setupPad(document.getElementById("lookPad"),(x,y)=>{state.lookX=x;state.lookY=-y;});

  function holdButton(id, field, value) {
    const button=document.getElementById(id); let pointer=null;
    button.addEventListener("pointerdown",e=>{pointer=e.pointerId;button.setPointerCapture?.(pointer);state[field]=value;});
    const release=e=>{if(pointer!==null&&(e.pointerId==null||e.pointerId===pointer)){pointer=null;state[field]=0;}};
    button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);
    button.addEventListener("lostpointercapture",release);
    window.addEventListener("blur",release);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)release({});});
  }
  holdButton("r1Btn","height",1); holdButton("l1Btn","height",-1); holdButton("teleBtn","focal",1); holdButton("wideBtn","focal",-1);
  holdButton("upBtn","height",1); holdButton("downBtn","height",-1);

  document.getElementById("recBtn").addEventListener("click",()=>{state.command="toggle-record";});
  document.getElementById("stopBtn").addEventListener("click",()=>{state.command="stop";});
  motionButton.addEventListener("click",()=>{ if(motionRequested) disableMotion(); else enableMotion(); });
  zeroButton.addEventListener("click",()=>{ state.command="motion-zero"; setStatus("모션 기준점 재설정", "warn"); });

  async function send() {
    if (sendBusy) return;
    sendBusy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    state.seq += 1; const command=state.command; state.command="";
    const payload={...state,command,sentAt:Date.now()};
    try {
      const response=await fetch("/input?token=" + encodeURIComponent(token),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:controller.signal});
      if(!response.ok) throw new Error(String(response.status));
      if (state.motionActive) setStatus("모션 연결됨","ok");
      else if (!motionRequested && status.textContent === "연결 끊김") setStatus("연결됨","ok");
      else if (status.textContent === "연결 중") setStatus("연결됨","ok");
    } catch { setStatus("연결 끊김","warn"); }
    finally { clearTimeout(timeout); sendBusy = false; }
  }
  setInterval(()=>{
    if (motionRequested && lastOrientationAt && Date.now() - lastOrientationAt > 1200) {
      motionRequested = false;
      state.motionActive = false;
      zeroButton.disabled = true;
      motionButton.textContent = "📱 모션 앵글 재시작";
      setStatus("모션 신호 없음 · 조이스틱은 사용 가능", "warn");
    }
    send();
  },33); send();
  refreshPreview();
  setInterval(refreshPreview, PREVIEW_POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)disableMotion();});
  window.addEventListener("beforeunload", () => { if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl); });
})();
</script>
</body></html>`;
}

function createPhoneRemoteBridge({ getWindow, writeLog = () => {} } = {}) {
  let server = null;
  let port = 0;
  let token = crypto.randomBytes(24).toString("base64url");
  let lastInputAt = 0;
  let pendingInput = null;
  let dispatchTimer = null;
  let lastDispatchAt = 0;
  let previewFrame = null;
  let previewAt = 0;
  let previewSeq = 0;

  function authorized(requestUrl) {
    try {
      const parsed = new URL(requestUrl, "http://127.0.0.1");
      const supplied = parsed.searchParams.get("token") || "";
      const expected = Buffer.from(token);
      const received = Buffer.from(supplied);
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    } catch {
      return false;
    }
  }

  function dispatchNow() {
    dispatchTimer = null;
    if (!pendingInput) return;
    const payload = pendingInput;
    pendingInput = null;
    lastDispatchAt = Date.now();
    const window = typeof getWindow === "function" ? getWindow() : null;
    if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return;
    const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
    window.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input",{detail:${serialized}}));`,
      true,
    ).catch((error) => writeLog(`phone remote dispatch failed: ${error.stack || error}`));
  }

  function scheduleDispatch(input) {
    pendingInput = input;
    const elapsed = Date.now() - lastDispatchAt;
    if (elapsed >= DISPATCH_INTERVAL_MS) {
      dispatchNow();
      return;
    }
    if (!dispatchTimer) dispatchTimer = setTimeout(dispatchNow, DISPATCH_INTERVAL_MS - elapsed);
  }

  function respondJson(response, statusCode, payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  }

  function setPreviewFrame(dataUrl) {
    if (typeof dataUrl !== "string" || dataUrl.length > MAX_PREVIEW_BYTES * 2) return false;
    const match = dataUrl.match(/^data:(image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return false;
    let decoded;
    try { decoded = Buffer.from(match[2], "base64"); } catch { return false; }
    if (!decoded.length || decoded.length > MAX_PREVIEW_BYTES) return false;
    previewFrame = decoded;
    previewAt = Date.now();
    previewSeq += 1;
    return true;
  }

  function handleRequest(request, response) {
    const requestUrl = request.url || "/";
    if (!authorized(requestUrl)) {
      respondJson(response, 403, { error: "pairing-token-required" });
      return;
    }
    const parsed = new URL(requestUrl, "http://127.0.0.1");
    if (request.method === "GET" && parsed.pathname === "/") {
      const body = Buffer.from(controllerHtml(token), "utf8");
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": body.length,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      response.end(body);
      return;
    }
    if (request.method === "GET" && parsed.pathname === "/status") {
      respondJson(response, 200, { ok: true, lastInputAt, previewAt, previewSeq, previewAvailable: Boolean(previewFrame) });
      return;
    }
    if (request.method === "GET" && parsed.pathname === "/preview") {
      if (!previewFrame) {
        response.writeHead(204, { "cache-control": "no-store", "x-content-type-options": "nosniff" });
        response.end();
        return;
      }
      response.writeHead(200, {
        "content-type": "image/jpeg",
        "content-length": previewFrame.length,
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "x-content-type-options": "nosniff",
        "x-frisframe-preview-seq": String(previewSeq),
      });
      response.end(previewFrame);
      return;
    }
    if (request.method !== "POST" || parsed.pathname !== "/input") {
      respondJson(response, 404, { error: "not-found" });
      return;
    }
    const contentType = String(request.headers["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      respondJson(response, 415, { error: "json-required" });
      return;
    }
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        respondJson(response, 413, { error: "payload-too-large" });
        return;
      }
      try {
        const input = sanitizeInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        lastInputAt = Date.now();
        scheduleDispatch({ ...input, receivedAt: lastInputAt });
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
      } catch {
        respondJson(response, 400, { error: "invalid-json" });
      }
    });
  }

  async function start() {
    if (server) return getConfig();
    token = crypto.randomBytes(24).toString("base64url");
    server = http.createServer(handleRequest);
    server.on("clientError", (_error, socket) => {
      try { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); } catch { /* ignore */ }
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "0.0.0.0", () => {
        server.off("error", reject);
        const address = server.address();
        port = typeof address === "object" && address ? Number(address.port) : 0;
        resolve();
      });
    });
    writeLog(`phone remote ready protocol=http port=${port}`);
    return getConfig();
  }

  function stop() {
    if (dispatchTimer) clearTimeout(dispatchTimer);
    dispatchTimer = null;
    pendingInput = null;
    previewFrame = null;
    previewAt = 0;
    previewSeq = 0;
    const active = server;
    server = null;
    port = 0;
    if (active) {
      try { active.close(); } catch { /* already closed */ }
    }
  }

  function getConfig() {
    if (!server || !port) return null;
    const addresses = privateIpv4Addresses();
    return {
      port,
      protocol: "http",
      secure: false,
      pairingCode: token.slice(0, 6).toUpperCase(),
      urls: addresses.map((address) => `http://${address}:${port}/?token=${encodeURIComponent(token)}`),
      hasLanAddress: addresses.length > 0,
    };
  }

  return { start, stop, getConfig, setPreviewFrame };
}

module.exports = { createPhoneRemoteBridge, sanitizeInput, privateIpv4Addresses };
