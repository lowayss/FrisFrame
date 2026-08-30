"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");

const MAX_BODY_BYTES = 8192;
const DISPATCH_INTERVAL_MS = 32;

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
  const command = ["", "toggle-record", "stop", "cancel", "zero"].includes(String(payload.command || ""))
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
    sensorActive: payload.sensorActive === true,
    sensorYaw: clamp(payload.sensorYaw, -720, 720),
    sensorPitch: clamp(payload.sensorPitch, -180, 180),
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
.app{min-height:100vh;display:grid;grid-template-rows:auto auto 1fr auto;gap:12px;padding:14px;max-width:820px;margin:auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{font-weight:900;letter-spacing:.02em}.pill{padding:6px 9px;border:1px solid #2b3742;border-radius:999px;font-size:12px;color:#aeb8c2;background:#111820}.pill.ok{color:#a8f0bf;border-color:#315c3e}.pill.warn{color:#ffd18a;border-color:#614a28}
.actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}button{min-height:46px;border:1px solid #34404b;border-radius:10px;background:#161d24;color:#edf2f6;font-weight:850;font-size:14px}button:active,button.on{background:#27333e;border-color:#6f879c}.rec{border-color:#713a3a;color:#ffd3d3}.stop{border-color:#5e4c2e;color:#ffe1aa}
.controls{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center}.padWrap{display:grid;gap:8px;place-items:center}.label{font-size:12px;color:#8f9aa5;font-weight:800}.pad{position:relative;width:min(42vw,260px);aspect-ratio:1;border:1px solid #34414c;border-radius:50%;background:radial-gradient(circle,#18222b 0 22%,#111820 23% 52%,#0e141a 53%);box-shadow:inset 0 0 28px #0008}.stick{position:absolute;width:34%;aspect-ratio:1;border-radius:50%;left:33%;top:33%;background:radial-gradient(circle at 35% 30%,#596775,#28333d 62%,#1a222a);border:1px solid #758391;box-shadow:0 8px 22px #0008;transform:translate(0,0)}
.trim{display:grid;grid-template-columns:1fr 1fr;gap:8px}.trim button{min-height:40px;font-size:12px}.sensorInfo{min-height:42px;padding:9px 10px;border:1px solid #26313a;border-radius:9px;color:#8d99a4;background:#0f151b;font-size:11px;line-height:1.45}.sensorInfo strong{color:#d9e0e7}.footer{font-size:10px;color:#65717c;text-align:center;line-height:1.45}
@media(max-width:560px){.app{padding:10px;gap:9px}.actions{grid-template-columns:1fr 1fr}.controls{gap:8px}.pad{width:min(44vw,230px)}}
</style>
</head>
<body>
<div class="app">
  <div class="top"><div class="brand">FrisFrame · PHONE CAMERA</div><div id="status" class="pill">연결 중</div></div>
  <div class="actions">
    <button id="sensorBtn">센서 시작</button><button id="zeroBtn">ZERO</button><button id="recBtn" class="rec">● REC</button><button id="stopBtn" class="stop">■ STOP</button>
  </div>
  <div class="controls">
    <div class="padWrap"><div class="label">이동 · Truck / Dolly</div><div id="movePad" class="pad"><div class="stick"></div></div></div>
    <div class="padWrap"><div class="label">시선 · Pan / Tilt</div><div id="lookPad" class="pad"><div class="stick"></div></div></div>
  </div>
  <div>
    <div class="trim"><button id="downBtn">▼ 카메라 낮춤</button><button id="upBtn">▲ 카메라 높임</button><button id="wideBtn">− Wide</button><button id="teleBtn">＋ Tele</button></div>
    <div id="sensorInfo" class="sensorInfo"></div>
    <div class="footer">같은 Wi‑Fi에서 사용하세요. 센서 회전이 막힌 브라우저에서도 두 조이스틱으로 전체 운용이 가능합니다.</div>
  </div>
</div>
<script>
(() => {
  "use strict";
  const token = ${safeToken};
  const state = { moveX:0,moveY:0,lookX:0,lookY:0,height:0,focal:0,sensorActive:false,sensorYaw:0,sensorPitch:0,axisSwap:false,command:"",seq:0 };
  const status = document.getElementById("status");
  const sensorInfo = document.getElementById("sensorInfo");
  let sensorPermission = false;
  let sensorBase = null;
  let lastSensor = null;

  const shortest = (from,to) => { let d = Number(to||0)-Number(from||0); while(d>180)d-=360; while(d<-180)d+=360; return d; };
  const setStatus = (text, kind="") => { status.textContent=text; status.className="pill"+(kind?" "+kind:""); };
  const explainSensor = (extra="") => {
    const secure = window.isSecureContext;
    sensorInfo.innerHTML = `<strong>폰 기울기:</strong> ${sensorPermission ? "활성" : "대기"} · ${secure ? "보안 컨텍스트" : "HTTP LAN"}${extra ? "<br>"+extra : ""}`;
  };
  explainSensor(!window.isSecureContext ? "모바일 브라우저 정책에 따라 자이로가 차단될 수 있습니다. 이 경우 오른쪽 조이스틱이 Pan/Tilt를 담당합니다." : "");

  function setupPad(root, onValue) {
    const stick = root.querySelector(".stick");
    let pointer = null;
    function apply(event) {
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      let x = (event.clientX-cx)/(rect.width*.36), y=(event.clientY-cy)/(rect.height*.36);
      const length = Math.hypot(x,y); if(length>1){x/=length;y/=length;}
      stick.style.transform=`translate(${x*75}%,${y*75}%)`; onValue(x,y);
    }
    root.addEventListener("pointerdown", e=>{pointer=e.pointerId;root.setPointerCapture?.(pointer);apply(e);});
    root.addEventListener("pointermove", e=>{if(e.pointerId===pointer)apply(e);});
    const release=e=>{if(pointer!==null && (e.pointerId==null||e.pointerId===pointer)){pointer=null;stick.style.transform="translate(0,0)";onValue(0,0);}};
    root.addEventListener("pointerup",release);root.addEventListener("pointercancel",release);
  }
  setupPad(document.getElementById("movePad"),(x,y)=>{state.moveX=x;state.moveY=-y;});
  setupPad(document.getElementById("lookPad"),(x,y)=>{state.lookX=x;state.lookY=-y;});

  function holdButton(id, field, value) {
    const button=document.getElementById(id); let pointer=null;
    button.addEventListener("pointerdown",e=>{pointer=e.pointerId;button.setPointerCapture?.(pointer);state[field]=value;});
    const release=e=>{if(pointer!==null&&(e.pointerId==null||e.pointerId===pointer)){pointer=null;state[field]=0;}};
    button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);
  }
  holdButton("upBtn","height",1); holdButton("downBtn","height",-1); holdButton("teleBtn","focal",1); holdButton("wideBtn","focal",-1);

  async function enableSensors() {
    try {
      if (!window.isSecureContext) throw new Error("브라우저가 HTTP LAN에서 방향 센서를 허용하지 않을 수 있습니다.");
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw new Error("방향 센서 권한이 거부되었습니다.");
      }
      window.addEventListener("deviceorientation", onOrientation, { passive:true });
      sensorPermission = true; state.sensorActive = true; sensorBase = null;
      document.getElementById("sensorBtn").classList.add("on"); explainSensor("ZERO를 누르면 현재 폰 각도를 카메라 기준점으로 다시 잡습니다.");
    } catch (error) {
      sensorPermission=false;state.sensorActive=false;explainSensor(String(error.message||error));
    }
  }
  function onOrientation(event) {
    if (!sensorPermission) return;
    const yaw = Number(event.alpha); const pitch = Number(event.beta);
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    lastSensor={yaw,pitch}; if(!sensorBase) sensorBase={yaw,pitch};
    state.sensorYaw=shortest(sensorBase.yaw,yaw); state.sensorPitch=Math.max(-90,Math.min(90,pitch-sensorBase.pitch));
  }
  document.getElementById("sensorBtn").addEventListener("click",()=>{ if(sensorPermission){sensorPermission=false;state.sensorActive=false;document.getElementById("sensorBtn").classList.remove("on");explainSensor("오른쪽 조이스틱으로 Pan/Tilt를 조작합니다.");}else enableSensors(); });
  document.getElementById("zeroBtn").addEventListener("click",()=>{if(lastSensor)sensorBase={...lastSensor};state.sensorYaw=0;state.sensorPitch=0;state.command="zero";});
  document.getElementById("recBtn").addEventListener("click",()=>{state.command="toggle-record";});
  document.getElementById("stopBtn").addEventListener("click",()=>{state.command="stop";});

  async function send() {
    state.seq += 1; const command=state.command; state.command="";
    const payload={...state,command,sentAt:Date.now()};
    try {
      const response=await fetch(`/input?token=${encodeURIComponent(token)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
      if(!response.ok) throw new Error(String(response.status)); setStatus("연결됨","ok");
    } catch { setStatus("연결 끊김","warn"); }
  }
  setInterval(send,33); send();
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
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      response.end(body);
      return;
    }
    if (request.method === "GET" && parsed.pathname === "/status") {
      respondJson(response, 200, { ok: true, lastInputAt });
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
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) request.destroy();
      else chunks.push(chunk);
    });
    request.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
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
    writeLog(`phone remote ready port=${port}`);
    return getConfig();
  }

  function stop() {
    if (dispatchTimer) clearTimeout(dispatchTimer);
    dispatchTimer = null;
    pendingInput = null;
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
      pairingCode: token.slice(0, 6).toUpperCase(),
      urls: addresses.map((address) => `http://${address}:${port}/?token=${encodeURIComponent(token)}`),
      hasLanAddress: addresses.length > 0,
    };
  }

  return { start, stop, getConfig };
}

module.exports = { createPhoneRemoteBridge, sanitizeInput, privateIpv4Addresses };
