"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const { privateIpv4Addresses } = require("./phone-remote.cjs");
const { tryEnsureTlsMaterial } = require("./phone-remote-tls.cjs");
const legacy = require("./phone-motion-server.cjs");

const MAX_BODY_BYTES = 16 * 1024;
const DISPATCH_INTERVAL_MS = 16;

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function sanitizeSessionId(value) {
  return String(value || "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 64);
}

function sanitizeMotionInput(payload = {}) {
  return {
    ...legacy.sanitizeMotionInput(payload),
    sessionId:sanitizeSessionId(payload.sessionId),
    clientRttMs:clamp(payload.clientRttMs, 0, 2000),
  };
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`phone_motion_v2_patch_missing:${label}`);
  return source.replace(search, replacement);
}

function patchMotionHtml(source) {
  let html = String(source || "");
  html = replaceRequired(
    html,
    'let stream=null,timer=null,previous=null,seq=0,command="",calibrationId=0,xrSession=null,xrSpace=null,xrGl=null;',
    'let stream=null,timer=null,previous=null,seq=0,command="",calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,sendInFlight=false,sendQueued=false,lastRttMs=0,xrNeedsRecenter=false;const sessionId=(Date.now().toString(36)+Math.random().toString(36).slice(2,10));',
    "transport-state",
  );
  html = replaceRequired(html, "timer=setInterval(track,100);", "timer=setInterval(track,50);", "visual-flow-rate");

  const oldXrFrame = 'function xrFrame(_time,frame){const session=frame.session;if(!xrSpace)return;if(xrGl&&session.renderState.baseLayer){xrGl.bindFramebuffer(xrGl.FRAMEBUFFER,session.renderState.baseLayer.framebuffer);xrGl.clearColor(0,0,0,0);xrGl.clear(xrGl.COLOR_BUFFER_BIT|xrGl.DEPTH_BUFFER_BIT)}const pose=frame.getViewerPose(xrSpace);if(pose){const p=pose.transform.position,o=pose.transform.orientation;state.spatial={mode:"webxr",metric:true,position:{x:p.x,y:p.y,z:p.z},orientation:{x:o.x,y:o.y,z:o.z,w:o.w},confidence:1};state.enabled=true;$("flow").textContent="100%";$("track").textContent="6DoF"}session.requestAnimationFrame(xrFrame)}';
  const newXrFrame = 'function xrFrame(_time,frame){const session=frame.session;if(!xrSpace)return;if(xrGl&&session.renderState.baseLayer){xrGl.bindFramebuffer(xrGl.FRAMEBUFFER,session.renderState.baseLayer.framebuffer);xrGl.clearColor(0,0,0,0);xrGl.clear(xrGl.COLOR_BUFFER_BIT|xrGl.DEPTH_BUFFER_BIT)}const pose=frame.getViewerPose(xrSpace);if(pose){const p=pose.transform.position,o=pose.transform.orientation;state.spatial={mode:"webxr",metric:true,position:{x:p.x,y:p.y,z:p.z},orientation:{x:o.x,y:o.y,z:o.z,w:o.w},confidence:1};state.enabled=true;if(xrNeedsRecenter){recenter();xrNeedsRecenter=false}$("flow").textContent="100%";$("track").textContent="6DoF"}else if(state.spatial.mode==="webxr"){state.spatial={...state.spatial,confidence:0};$("flow").textContent="0%";$("track").textContent="6DoF?"}session.requestAnimationFrame(xrFrame)}';
  html = replaceRequired(html, oldXrFrame, newXrFrame, "xr-frame");

  html = replaceRequired(
    html,
    'xrSpace=await xrSession.requestReferenceSpace("local");state.enabled=true;state.visual={x:0,y:0,z:0,confidence:0,metric:false};recenter();xrSession.addEventListener("end",()=>{',
    'xrSpace=await xrSession.requestReferenceSpace("local");state.enabled=true;state.visual={x:0,y:0,z:0,confidence:0,metric:false};state.spatial={mode:"none",metric:false,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:0};xrNeedsRecenter=true;xrSpace.addEventListener?.("reset",()=>{xrNeedsRecenter=true});xrSession.addEventListener("end",()=>{',
    "xr-first-pose-anchor",
  );

  const oldSend = 'async function send(){seq++;const payload={seq,sentAt:Date.now(),command,motion:{...state,calibrationId}};command="";try{const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});if(!res.ok)throw new Error(String(res.status));if(state.enabled)setStatus(state.spatial.mode==="webxr"?"6DoF XR":"MOTION ON","ok")}catch{setStatus("연결 끊김","warn")}}';
  const newSend = 'async function send(){if(sendInFlight){sendQueued=true;return}sendInFlight=true;sendQueued=false;seq++;const outgoingCommand=command;command="";const started=performance.now();const payload={sessionId,seq,sentAt:Date.now(),clientRttMs:lastRttMs,command:outgoingCommand,motion:{...state,calibrationId}};try{const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store",keepalive:true});if(!res.ok)throw new Error(String(res.status));if(state.enabled)setStatus(state.spatial.mode==="webxr"?"6DoF XR":"MOTION ON","ok")}catch{setStatus("연결 끊김","warn")}finally{lastRttMs=clamp(performance.now()-started,0,2000);sendInFlight=false;if(sendQueued||command)queueMicrotask(send)}}';
  html = replaceRequired(html, oldSend, newSend, "single-flight-send");
  html = replaceRequired(html, '$("center").addEventListener("click",recenter);', '$("center").addEventListener("click",()=>{recenter();send()});', "recenter-send");
  html = replaceRequired(html, '$("rec").addEventListener("click",()=>{command="toggle-record"});', '$("rec").addEventListener("click",()=>{command="toggle-record";send()});', "record-send");
  html = replaceRequired(html, '$("stop").addEventListener("click",()=>{command="stop"});', '$("stop").addEventListener("click",()=>{command="stop";send()});', "stop-send");
  html = replaceRequired(html, "setInterval(send,33);send();", "setInterval(()=>{if(state.enabled||command)send()},16);send();", "send-rate");
  return html;
}

function motionHtml(token) {
  return patchMotionHtml(legacy.motionHtml(token));
}

function createLatestDispatcher({
  dispatch,
  intervalMs = DISPATCH_INTERVAL_MS,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof dispatch !== "function") throw new TypeError("dispatch_required");
  let pending = null;
  let timer = null;
  let lastDispatchAt = Number.NEGATIVE_INFINITY;
  let lastSeq = -1;
  let sessionId = "";

  function resetSequence(nextSessionId) {
    sessionId = nextSessionId;
    lastSeq = -1;
    pending = null;
    if (timer) clearTimer(timer);
    timer = null;
  }

  function emit(payload) {
    lastDispatchAt = now();
    dispatch(payload);
  }

  function flush() {
    timer = null;
    if (!pending) return false;
    const payload = pending;
    pending = null;
    emit(payload);
    return true;
  }

  function push(payload = {}) {
    const nextSessionId = sanitizeSessionId(payload.sessionId);
    if (nextSessionId && nextSessionId !== sessionId) resetSequence(nextSessionId);
    const seq = Math.max(0, Math.floor(Number(payload.seq) || 0));
    if (seq <= lastSeq) return { accepted:false, reason:"stale-sequence", seq, lastSeq };
    lastSeq = seq;

    if (payload.command) {
      pending = null;
      if (timer) clearTimer(timer);
      timer = null;
      emit(payload);
      return { accepted:true, immediate:true, seq };
    }

    pending = payload;
    const elapsed = now() - lastDispatchAt;
    if (elapsed >= intervalMs) {
      flush();
      return { accepted:true, immediate:true, seq };
    }
    if (!timer) timer = setTimer(flush, Math.max(0, intervalMs - elapsed));
    return { accepted:true, immediate:false, seq };
  }

  function stop() {
    if (timer) clearTimer(timer);
    timer = null;
    pending = null;
  }

  return Object.freeze({
    push,
    flush,
    stop,
    get status() {
      return { sessionId, lastSeq, pending:Boolean(pending), lastDispatchAt, intervalMs };
    },
  });
}

function createPhoneMotionBridge({ getWindow, writeLog = () => {}, tlsDirectory } = {}) {
  let httpServer = null;
  let httpsServer = null;
  let httpPort = 0;
  let httpsPort = 0;
  let token = crypto.randomBytes(24).toString("base64url");
  let tls = null;
  let lastInputAt = 0;

  const dispatcher = createLatestDispatcher({
    intervalMs:DISPATCH_INTERVAL_MS,
    dispatch:(payload) => {
      const window = typeof getWindow === "function" ? getWindow() : null;
      if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return;
      const dispatchedAt = Date.now();
      const detail = {
        ...payload,
        dispatchedAt,
        dispatchLagMs:Math.max(0, dispatchedAt - Number(payload.receivedAt || dispatchedAt)),
      };
      try {
        window.webContents.send("phone-motion:input", detail);
      } catch (error) {
        writeLog(`phone motion ipc dispatch failed: ${error.stack || error}`);
      }
    },
  });

  function authorized(requestUrl) {
    try {
      const parsed = new URL(requestUrl, "http://127.0.0.1");
      const supplied = parsed.searchParams.get("token") || "";
      const expected = Buffer.from(token);
      const received = Buffer.from(supplied);
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    } catch { return false; }
  }

  function jsonResponse(response, statusCode, payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(statusCode, {
      "content-type":"application/json; charset=utf-8",
      "content-length":body.length,
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    });
    response.end(body);
  }

  function htmlResponse(response, body) {
    const buffer = Buffer.from(body, "utf8");
    response.writeHead(200, {
      "content-type":"text/html; charset=utf-8",
      "content-length":buffer.length,
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "referrer-policy":"no-referrer",
      "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    response.end(buffer);
  }

  function readJson(request, response, callback) {
    const contentType = String(request.headers["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("application/json")) { jsonResponse(response, 415, {error:"json-required"}); return; }
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { tooLarge = true; chunks.length = 0; return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) { jsonResponse(response, 413, {error:"payload-too-large"}); return; }
      try { callback(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { jsonResponse(response, 400, {error:"invalid-json"}); }
    });
  }

  function hostFromRequest(request) {
    const raw = String(request.headers.host || "127.0.0.1");
    return raw.startsWith("[") ? raw.slice(1, raw.indexOf("]")) : raw.split(":")[0];
  }

  function secureUrl(request) {
    if (!httpsPort || !tls?.available) return "";
    return `https://${hostFromRequest(request)}:${httpsPort}/?token=${encodeURIComponent(token)}`;
  }

  function handleRequest(request, response, secure) {
    const requestUrl = request.url || "/";
    if (!authorized(requestUrl)) { jsonResponse(response, 403, {error:"pairing-token-required"}); return; }
    const parsed = new URL(requestUrl, "http://127.0.0.1");
    if (request.method === "GET" && parsed.pathname === "/") {
      htmlResponse(response, secure
        ? motionHtml(token)
        : legacy.bootstrapHtml(token, secureUrl(request), tls?.fingerprintSha256, tls?.error));
      return;
    }
    if (request.method === "GET" && parsed.pathname === "/ca.cer" && !secure && tls?.available) {
      response.writeHead(200, {
        "content-type":"application/x-x509-ca-cert",
        "content-disposition":"attachment; filename=FrisFrame-Phone-Camera-CA.crt",
        "content-length":tls.ca.length,
        "cache-control":"no-store",
        "x-content-type-options":"nosniff",
      });
      response.end(tls.ca);
      return;
    }
    if (request.method === "GET" && parsed.pathname === "/status") {
      jsonResponse(response, 200, {ok:true,secure,lastInputAt,transport:dispatcher.status});
      return;
    }
    if (request.method !== "POST" || parsed.pathname !== "/input") { jsonResponse(response, 404, {error:"not-found"}); return; }
    readJson(request, response, (body) => {
      const input = sanitizeMotionInput(body);
      lastInputAt = Date.now();
      const result = dispatcher.push({...input,receivedAt:lastInputAt});
      response.writeHead(204, {
        "cache-control":"no-store",
        "x-frisframe-input":result.accepted ? "accepted" : "stale",
      });
      response.end();
    });
  }

  function listen(server) {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "0.0.0.0", () => {
        server.off("error", reject);
        resolve(Number(server.address()?.port) || 0);
      });
    });
  }

  async function start() {
    if (httpServer) return getConfig();
    token = crypto.randomBytes(24).toString("base64url");
    const addresses = privateIpv4Addresses();
    tls = tryEnsureTlsMaterial({directory:tlsDirectory,hosts:addresses});
    httpServer = http.createServer((req,res) => handleRequest(req,res,false));
    httpServer.on("clientError", (_error, socket) => {
      try { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); } catch {}
    });
    httpPort = await listen(httpServer);

    if (tls?.available) {
      try {
        httpsServer = https.createServer({key:tls.key,cert:tls.cert}, (req,res) => handleRequest(req,res,true));
        httpsServer.on("clientError", (_error, socket) => {
          try { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); } catch {}
        });
        httpsPort = await listen(httpsServer);
      } catch (error) {
        try { httpsServer?.close(); } catch {}
        httpsServer = null;
        httpsPort = 0;
        tls = {...tls,available:false,error:String(error?.message || error)};
        writeLog(`phone motion https failed: ${error.stack || error}`);
      }
    }
    writeLog(`phone physical camera v2 ready http=${httpPort} https=${httpsPort || "unavailable"} dispatch=${DISPATCH_INTERVAL_MS}ms`);
    return getConfig();
  }

  function stop() {
    dispatcher.stop();
    for (const server of [httpServer,httpsServer]) if (server) try { server.close(); } catch {}
    httpServer = null;
    httpsServer = null;
    httpPort = 0;
    httpsPort = 0;
  }

  function getConfig() {
    if (!httpServer || !httpPort) return null;
    const addresses = privateIpv4Addresses();
    return {
      pairingCode:token.slice(0,6).toUpperCase(),
      bootstrapUrls:addresses.map((address) => `http://${address}:${httpPort}/?token=${encodeURIComponent(token)}`),
      secureUrls:httpsPort && tls?.available
        ? addresses.map((address) => `https://${address}:${httpsPort}/?token=${encodeURIComponent(token)}`)
        : [],
      tls:{available:Boolean(httpsPort && tls?.available),fingerprintSha256:tls?.fingerprintSha256 || null,error:tls?.error || null},
      hasLanAddress:addresses.length > 0,
      lastInputAt,
      transport:{dispatchIntervalMs:DISPATCH_INTERVAL_MS,mode:"ipc-latest-only"},
    };
  }

  return { start, stop, getConfig };
}

module.exports = {
  DISPATCH_INTERVAL_MS,
  sanitizeMotionInput,
  patchMotionHtml,
  motionHtml,
  createLatestDispatcher,
  createPhoneMotionBridge,
};
