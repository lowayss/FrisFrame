"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const { privateIpv4Addresses } = require("./phone-remote.cjs");
const { tryEnsureTlsMaterial } = require("./phone-remote-tls.cjs");

const MAX_BODY_BYTES = 16 * 1024;
const DISPATCH_INTERVAL_MS = 32;

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function sanitizeMotionInput(payload = {}) {
  const motion = payload.motion || {};
  const orientation = motion.orientation || {};
  const acceleration = motion.acceleration || {};
  const visual = motion.visual || {};
  const command = ["", "toggle-record", "stop", "cancel"].includes(String(payload.command || ""))
    ? String(payload.command || "")
    : "";
  return {
    seq: Math.max(0, Math.floor(Number(payload.seq) || 0)),
    sentAt: Number(payload.sentAt) || Date.now(),
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    height: 0,
    focal: 0,
    command,
    motion: {
      enabled: motion.enabled === true,
      calibrationId: Math.max(0, Math.floor(Number(motion.calibrationId) || 0)),
      screenAngle: clamp(motion.screenAngle, -360, 360),
      orientation: {
        alpha: clamp(orientation.alpha, -360, 360),
        beta: clamp(orientation.beta, -180, 180),
        gamma: clamp(orientation.gamma, -90, 90),
        absolute: orientation.absolute === true,
      },
      acceleration: {
        x: clamp(acceleration.x, -100, 100),
        y: clamp(acceleration.y, -100, 100),
        z: clamp(acceleration.z, -100, 100),
      },
      visual: {
        x: clamp(visual.x, -8, 8),
        y: clamp(visual.y, -8, 8),
        z: clamp(visual.z, -8, 8),
        confidence: clamp(visual.confidence, 0, 1),
        metric: false,
      },
    },
  };
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

function bootstrapHtml(token, secureUrl, fingerprint, tlsError) {
  const encoded = encodeURIComponent(token);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0f12"><title>FrisFrame Motion Camera Setup</title><style>:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#0b0f12;color:#edf2f6;padding:22px}.card{max-width:620px;margin:auto;background:#131a20;border:1px solid #2e3a44;border-radius:18px;padding:20px}h1{font-size:22px;margin:0 0 10px}.muted{color:#98a5b0;line-height:1.55}.warn{background:#241b11;border:1px solid #654b2a;color:#ffd69a;border-radius:12px;padding:12px;margin:12px 0}.btn{display:block;margin:9px 0;padding:14px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#ff6b55;color:white}.secondary{background:#202a32;color:#eef2f6;border:1px solid #394854}.fp{font:10px ui-monospace;overflow-wrap:anywhere;color:#8996a1}</style></head><body><div class="card"><h1>FrisFrame · 실제 모션 카메라</h1><p class="muted">휴대폰을 손에 들고 움직이면 FrisFrame Camera Operator가 Pan/Tilt와 상대 Truck/Dolly/Pedestal 움직임을 따라갑니다.</p>${secureUrl ? `<div class="warn">최초 1회만 로컬 인증서를 설치·신뢰한 뒤 HTTPS 모션 카메라를 여세요.</div><a class="btn secondary" href="/ca.cer?token=${encoded}">1. FrisFrame 로컬 CA 설치</a><a class="btn" href="${secureUrl}">2. HTTPS 모션 카메라 열기</a><p class="fp">CA SHA-256 · ${fingerprint || "—"}</p>` : `<div class="warn">HTTPS 모션 카메라를 시작할 수 없습니다. ${String(tlsError || "OpenSSL을 사용할 수 없습니다.")}</div>`}<p class="muted">기존 조이스틱 Phone Remote는 별도로 계속 사용할 수 있습니다. 이 페이지는 물리적인 휴대폰 움직임 전용입니다.</p></div></body></html>`;
}

function motionHtml(token) {
  const safeToken = JSON.stringify(token);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#090d10"><title>FrisFrame Physical Camera</title><style>:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{margin:0;background:#090d10;color:#f2f5f7;overscroll-behavior:none}.app{max-width:760px;margin:auto;padding:12px;display:grid;gap:10px}.top{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:950}.brand b{color:#ff7864}.pill{font-size:11px;border:1px solid #33404a;border-radius:999px;padding:6px 9px;color:#aab5bf}.pill.ok{color:#a8f0bf;border-color:#315c3e}.pill.warn{color:#ffd18a;border-color:#614a28}.view{position:relative;background:#111820;border:1px solid #2d3943;border-radius:16px;overflow:hidden;aspect-ratio:9/13}video{width:100%;height:100%;object-fit:cover;display:block}.grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 49.8%,#ffffff28 50%,transparent 50.2%),linear-gradient(0deg,transparent 49.8%,#ffffff28 50%,transparent 50.2%)}.hud{position:absolute;left:10px;right:10px;bottom:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.stat{background:#070b0dcc;border:1px solid #33404a;border-radius:8px;padding:7px;text-align:center}.stat small{display:block;color:#87939d}.stat b{font:12px ui-monospace;color:#dfe8ef}.actions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}button{min-height:48px;border:1px solid #384650;border-radius:11px;background:#171f25;color:#eef3f6;font-weight:900}.primary{background:#ff6b55;border-color:#ff6b55}.rec{color:#ffb5b5;border-color:#713b3b}.note{border:1px solid #303c46;border-radius:11px;padding:10px;color:#94a1ab;font-size:11px;line-height:1.5}</style></head><body><div class="app"><div class="top"><div class="brand">FrisFrame · <b>PHYSICAL CAMERA</b></div><div id="status" class="pill">READY</div></div><div class="view"><video id="video" playsinline muted></video><div class="grid"></div><div class="hud"><div class="stat"><small>PAN</small><b id="pan">0.0°</b></div><div class="stat"><small>TILT</small><b id="tilt">0.0°</b></div><div class="stat"><small>FLOW</small><b id="flow">0%</b></div></div></div><div class="actions"><button id="start" class="primary">센서 + 카메라 시작</button><button id="center">재센터</button><button id="rec" class="rec">● REC</button><button id="stop">■ STOP</button></div><div class="note" id="note">버튼을 눌러 센서 권한과 후면 카메라 권한을 허용하세요. 카메라 영상은 이 휴대폰 안에서만 저해상도로 분석하며 PC로 전송하거나 저장하지 않습니다. Visual 이동은 상대 방향값이며 실제 미터 거리가 아닙니다.</div></div><script>(()=>{"use strict";const TOKEN=${safeToken},$=id=>document.getElementById(id),W=64,H=48,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=W;canvas.height=H;let stream=null,timer=null,previous=null,seq=0,command="",calibrationId=0;const state={enabled:false,screenAngle:0,orientation:{alpha:0,beta:0,gamma:0,absolute:false},acceleration:{x:0,y:0,z:0},visual:{x:0,y:0,z:0,confidence:0,metric:false}};const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));function setStatus(text,kind=""){const n=$("status");n.textContent=text;n.className="pill"+(kind?" "+kind:"");}function screenAngle(){return Number(screen.orientation?.angle??window.orientation??0)||0}function onOrientation(e){state.screenAngle=screenAngle();state.orientation={alpha:clamp(e.alpha,-360,360),beta:clamp(e.beta,-180,180),gamma:clamp(e.gamma,-90,90),absolute:Boolean(e.absolute)};$("pan").textContent=(state.orientation.alpha||0).toFixed(1)+"°";$("tilt").textContent=(state.orientation.beta||0).toFixed(1)+"°"}function onMotion(e){const a=e.acceleration||{};state.acceleration={x:clamp(a.x,-100,100),y:clamp(a.y,-100,100),z:clamp(a.z,-100,100)}}function grayFrame(){ctx.drawImage($("video"),0,0,W,H);const rgba=ctx.getImageData(0,0,W,H).data,out=new Uint8Array(W*H);for(let i=0,j=0;i<rgba.length;i+=4,j++)out[j]=(rgba[i]*3+rgba[i+1]*6+rgba[i+2])/10;return out}function px(frame,x,y){const ix=Math.max(0,Math.min(W-1,Math.round(x))),iy=Math.max(0,Math.min(H-1,Math.round(y)));return frame[iy*W+ix]}function score(prev,cur,dx,dy,scale){const cx=(W-1)/2,cy=(H-1)/2;let total=0,count=0;for(let y=7;y<H-7;y+=4)for(let x=7;x<W-7;x+=4){const sx=cx+(x-cx)/scale+dx,sy=cy+(y-cy)/scale+dy;if(sx<1||sx>=W-1||sy<1||sy>=H-1)continue;total+=Math.abs(cur[y*W+x]-px(prev,sx,sy));count++}return count?total/count:255}function estimate(prev,cur){const baseline=score(prev,cur,0,0,1);let best={dx:0,dy:0,scale:1,score:baseline,objective:baseline};for(const scale of [.97,1,1.03])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const s=score(prev,cur,dx,dy,scale),objective=s+Math.abs(scale-1)*.25+(Math.abs(dx)+Math.abs(dy))*.002;if(objective<best.objective)best={dx,dy,scale,score:s,objective}}const improvement=Math.max(0,baseline-best.score),confidence=baseline>1?clamp(improvement/(baseline+1)*5,0,1):0;return{...best,baseline,confidence}}function track(){if(!state.enabled||!$("video").videoWidth)return;const current=grayFrame();if(previous){const t=estimate(previous,current);if(t.confidence>=.18){state.visual.x=clamp(state.visual.x+clamp(-t.dx/(W*.12),-1,1)*.12,-8,8);state.visual.y=clamp(state.visual.y+clamp(t.dy/(H*.12),-1,1)*.12,-8,8);state.visual.z=clamp(state.visual.z+clamp((t.scale-1)/.03,-1,1)*.12,-8,8)}state.visual.confidence=t.confidence;$("flow").textContent=Math.round(t.confidence*100)+"%"}previous=current}async function permission(Ctor){if(typeof Ctor?.requestPermission==="function"){const result=await Ctor.requestPermission();if(result!=="granted")throw new Error("센서 권한이 거부되었습니다.")}}async function start(){try{await permission(window.DeviceOrientationEvent);await permission(window.DeviceMotionEvent);window.addEventListener("deviceorientation",onOrientation,true);window.addEventListener("devicemotion",onMotion,true);stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:640},height:{ideal:480}},audio:false});$("video").srcObject=stream;await $("video").play();state.enabled=true;previous=null;if(timer)clearInterval(timer);timer=setInterval(track,100);recenter();setStatus("MOTION ON","ok");$("note").textContent="실제 모션 카메라가 켜졌습니다. REC 후 휴대폰을 움직이세요. 재센터를 누른 순간의 카메라 위치/방향이 기준점이 됩니다."}catch(error){setStatus("권한 필요","warn");$("note").textContent=String(error?.message||error)}}function recenter(){calibrationId++;state.visual={x:0,y:0,z:0,confidence:0,metric:false};previous=null}async function send(){seq++;const payload={seq,sentAt:Date.now(),command,motion:{...state,calibrationId}};command="";try{const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});if(!res.ok)throw new Error(String(res.status));if(state.enabled)setStatus("MOTION ON","ok")}catch{setStatus("연결 끊김","warn")}}$("start").addEventListener("click",start);$("center").addEventListener("click",recenter);$("rec").addEventListener("click",()=>{command="toggle-record"});$("stop").addEventListener("click",()=>{command="stop"});setInterval(send,33);send();window.addEventListener("pagehide",()=>{if(timer)clearInterval(timer);stream?.getTracks?.().forEach(t=>t.stop())})})();</script></body></html>`;
}

function createPhoneMotionBridge({ getWindow, writeLog = () => {}, tlsDirectory } = {}) {
  let httpServer = null;
  let httpsServer = null;
  let httpPort = 0;
  let httpsPort = 0;
  let token = crypto.randomBytes(24).toString("base64url");
  let tls = null;
  let lastInputAt = 0;
  let pendingInput = null;
  let dispatchTimer = null;
  let lastDispatchAt = 0;

  function authorized(requestUrl) {
    try {
      const supplied = new URL(requestUrl, "http://127.0.0.1").searchParams.get("token") || "";
      const expected = Buffer.from(token), received = Buffer.from(supplied);
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    } catch { return false; }
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
    window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input",{detail:${serialized}}));`, true)
      .catch((error) => writeLog(`phone motion dispatch failed: ${error.stack || error}`));
  }

  function scheduleDispatch(input) {
    pendingInput = input;
    const elapsed = Date.now() - lastDispatchAt;
    if (elapsed >= DISPATCH_INTERVAL_MS) dispatchNow();
    else if (!dispatchTimer) dispatchTimer = setTimeout(dispatchNow, DISPATCH_INTERVAL_MS - elapsed);
  }

  function hostFromRequest(request) {
    const raw = String(request.headers.host || "127.0.0.1");
    return raw.startsWith("[") ? raw.slice(1, raw.indexOf("]")) : raw.split(":")[0];
  }

  function secureUrl(request) {
    if (!httpsPort || !tls?.available) return "";
    return `https://${hostFromRequest(request)}:${httpsPort}/?token=${encodeURIComponent(token)}`;
  }

  function readJson(request, response, callback) {
    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      jsonResponse(response, 415, { error:"json-required" }); return;
    }
    let size = 0, tooLarge = false; const chunks = [];
    request.on("data", (chunk) => { if (tooLarge) return; size += chunk.length; if (size > MAX_BODY_BYTES) { tooLarge = true; chunks.length = 0; return; } chunks.push(chunk); });
    request.on("end", () => {
      if (tooLarge) { jsonResponse(response, 413, { error:"payload-too-large" }); return; }
      try { callback(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { jsonResponse(response, 400, { error:"invalid-json" }); }
    });
  }

  function handleRequest(request, response, secure) {
    const requestUrl = request.url || "/";
    if (!authorized(requestUrl)) { jsonResponse(response, 403, { error:"pairing-token-required" }); return; }
    const parsed = new URL(requestUrl, "http://127.0.0.1");
    if (request.method === "GET" && parsed.pathname === "/") {
      htmlResponse(response, secure ? motionHtml(token) : bootstrapHtml(token, secureUrl(request), tls?.fingerprintSha256, tls?.error)); return;
    }
    if (request.method === "GET" && parsed.pathname === "/ca.cer" && !secure && tls?.available) {
      response.writeHead(200, {"content-type":"application/x-x509-ca-cert","content-disposition":"attachment; filename=FrisFrame-Phone-Camera-CA.crt","content-length":tls.ca.length,"cache-control":"no-store","x-content-type-options":"nosniff"}); response.end(tls.ca); return;
    }
    if (request.method === "GET" && parsed.pathname === "/status") { jsonResponse(response, 200, {ok:true,secure,lastInputAt}); return; }
    if (request.method !== "POST" || parsed.pathname !== "/input") { jsonResponse(response, 404, {error:"not-found"}); return; }
    readJson(request,response,(body)=>{const input=sanitizeMotionInput(body);lastInputAt=Date.now();scheduleDispatch({...input,receivedAt:lastInputAt});response.writeHead(204,{"cache-control":"no-store"});response.end();});
  }

  function listen(server) {
    return new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"0.0.0.0",()=>{server.off("error",reject);resolve(Number(server.address()?.port)||0);});});
  }

  async function start() {
    if (httpServer) return getConfig();
    token = crypto.randomBytes(24).toString("base64url");
    const addresses = privateIpv4Addresses();
    tls = tryEnsureTlsMaterial({directory:tlsDirectory,hosts:addresses});
    httpServer = http.createServer((req,res)=>handleRequest(req,res,false));
    httpPort = await listen(httpServer);
    if (tls.available) {
      try { httpsServer = https.createServer({key:tls.key,cert:tls.cert},(req,res)=>handleRequest(req,res,true)); httpsPort = await listen(httpsServer); }
      catch (error) { writeLog(`phone motion HTTPS failed: ${error.stack || error}`); try{httpsServer?.close();}catch{} httpsServer=null;httpsPort=0;tls={...tls,available:false,error:String(error?.message||error)}; }
    }
    writeLog(`phone physical camera ready http=${httpPort} https=${httpsPort || "unavailable"}`);
    return getConfig();
  }

  function stop() {
    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null; pendingInput=null;
    for (const server of [httpServer,httpsServer]) if (server) try { server.close(); } catch {}
    httpServer=null;httpsServer=null;httpPort=0;httpsPort=0;
  }

  function getConfig() {
    if (!httpServer || !httpPort) return null;
    const addresses = privateIpv4Addresses();
    return {
      pairingCode:token.slice(0,6).toUpperCase(),
      bootstrapUrls:addresses.map((address)=>`http://${address}:${httpPort}/?token=${encodeURIComponent(token)}`),
      secureUrls:httpsPort&&tls?.available?addresses.map((address)=>`https://${address}:${httpsPort}/?token=${encodeURIComponent(token)}`):[],
      tls:{available:Boolean(httpsPort&&tls?.available),fingerprintSha256:tls?.fingerprintSha256||null,error:tls?.error||null},
      hasLanAddress:addresses.length>0,
      lastInputAt,
    };
  }

  return { start, stop, getConfig };
}

module.exports = { createPhoneMotionBridge, sanitizeMotionInput, bootstrapHtml, motionHtml };
