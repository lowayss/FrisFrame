"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { privateIpv4Addresses } = require("./phone-remote.cjs");
const { tryEnsureTlsMaterial } = require("./phone-remote-tls.cjs");

const MAX_BODY_BYTES = 16 * 1024;
const DISPATCH_INTERVAL_MS = 24;
const VIEWFINDER_INTERVAL_MS = 66;
const VIEWFINDER_JPEG_QUALITY = 68;
const VIEWFINDER_MAX_WIDTH = 960;
const COMMAND_CACHE_MS = 60 * 1000;
const ALLOWED_COMMANDS = new Set(["", "toggle-record", "stop", "cancel"]);
const ALLOWED_RIGS = new Set(["raw", "handheld", "heavy"]);

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function normalizeQuaternion(value = {}) {
  const x = clamp(value.x, -1, 1);
  const y = clamp(value.y, -1, 1);
  const z = clamp(value.z, -1, 1);
  const w = clamp(value.w, -1, 1);
  const length = Math.hypot(x, y, z, w);
  if (length < 0.000001) return { x:0, y:0, z:0, w:1 };
  return { x:x/length, y:y/length, z:z/length, w:w/length };
}

function sanitizeCommandId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : "";
}

function sanitizeMotionInput(payload = {}) {
  const motion = payload.motion || {};
  const orientation = motion.orientation || {};
  const acceleration = motion.acceleration || {};
  const visual = motion.visual || {};
  const spatialInput = motion.spatial || {};
  const spatialMetric = spatialInput.mode === "webxr" && spatialInput.metric === true;
  const commandValue = String(payload.command || "");
  const command = ALLOWED_COMMANDS.has(commandValue) ? commandValue : "";
  const commandId = command ? sanitizeCommandId(payload.commandId) : "";
  const rigValue = String(payload.rigProfile || motion.rigProfile || "handheld");
  const rigProfile = ALLOWED_RIGS.has(rigValue) ? rigValue : "handheld";
  const requestedFocal = Number(payload.focalMm ?? motion.focalMm);
  const focalMm = Number.isFinite(requestedFocal) ? clamp(requestedFocal, 8, 300) : null;
  return {
    seq: Math.max(0, Math.floor(Number(payload.seq) || 0)),
    sentAt: Number(payload.sentAt) || Date.now(),
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    height: 0,
    focal: 0,
    focalMm,
    rigProfile,
    command,
    commandId,
    motion: {
      enabled: motion.enabled === true,
      calibrationId: Math.max(0, Math.floor(Number(motion.calibrationId) || 0)),
      screenAngle: clamp(motion.screenAngle, -360, 360),
      focalMm,
      rigProfile,
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
      spatial: spatialMetric ? {
        mode:"webxr",
        metric:true,
        position:{
          x:clamp(spatialInput.position?.x, -50, 50),
          y:clamp(spatialInput.position?.y, -50, 50),
          z:clamp(spatialInput.position?.z, -50, 50),
        },
        orientation:normalizeQuaternion(spatialInput.orientation),
        confidence:clamp(spatialInput.confidence, 0, 1),
      } : {
        mode:"none",
        metric:false,
        position:{x:0,y:0,z:0},
        orientation:{x:0,y:0,z:0,w:1},
        confidence:0,
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
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050709"><title>FrisFrame Director Viewfinder</title><style>:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#050709;color:#eef2f6;padding:22px}.card{max-width:620px;margin:auto;background:#10151a;border:1px solid #29343d;border-radius:18px;padding:20px}h1{font-size:22px;margin:0 0 10px}.muted{color:#9aa6af;line-height:1.6}.warn{background:#241b11;border:1px solid #654b2a;color:#ffd69a;border-radius:12px;padding:12px;margin:12px 0}.btn{display:block;margin:9px 0;padding:14px;border-radius:12px;text-align:center;text-decoration:none;font-weight:900;background:#ff6b55;color:white}.secondary{background:#202a32;color:#eef2f6;border:1px solid #394854}.fp{font:10px ui-monospace;overflow-wrap:anywhere;color:#8996a1}</style></head><body><div class="card"><h1>FrisFrame · Director Viewfinder</h1><p class="muted">휴대폰을 가상 핸드헬드 카메라처럼 사용합니다. 폰 화면은 FrisFrame 가상 카메라이고 후면 카메라는 움직임 추적 센서로만 사용됩니다.</p>${secureUrl ? `<div class="warn">최초 1회 로컬 인증서를 설치·신뢰한 뒤 HTTPS Director Viewfinder를 여세요.</div><a class="btn secondary" href="/ca.cer?token=${encoded}">1. FrisFrame 로컬 CA 설치</a><a class="btn" href="${secureUrl}">2. Director Viewfinder 열기</a><p class="fp">CA SHA-256 · ${fingerprint || "—"}</p>` : `<div class="warn">HTTPS Director Viewfinder를 시작할 수 없습니다. ${String(tlsError || "OpenSSL을 사용할 수 없습니다.")}</div>`}</div></body></html>`;
}

function motionHtml(token) {
  const safeToken = JSON.stringify(token);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#000"><title>FrisFrame Director Viewfinder</title><style>:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;width:100%;height:100%;background:#000;color:#fff;overflow:hidden;touch-action:manipulation}.app{position:fixed;inset:0;display:grid;grid-template-rows:auto 1fr auto}.top{z-index:4;display:flex;align-items:center;justify-content:space-between;padding:max(8px,env(safe-area-inset-top)) 12px 8px;background:#050709e8}.brand{font-weight:950;font-size:12px;letter-spacing:.08em}.brand b{color:#ff715b}.pill{font:10px ui-monospace;border:1px solid #3a4650;border-radius:999px;padding:5px 8px;color:#aeb8c1}.pill.ok{color:#a8f0bf;border-color:#315c3e}.pill.warn{color:#ffd18a;border-color:#614a28}.view{position:relative;min-height:0;background:#050608;overflow:hidden}.feed{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.tracker{position:absolute;width:2px;height:2px;opacity:.001;left:-4px;top:-4px}.grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 33.15%,#ffffff20 33.3%,transparent 33.45%,transparent 66.5%,#ffffff20 66.65%,transparent 66.8%),linear-gradient(0deg,transparent 33.15%,#ffffff20 33.3%,transparent 33.45%,transparent 66.5%,#ffffff20 66.65%,transparent 66.8%)}.center{position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);border:1px solid #ffffff60;border-radius:50%}.hud{position:absolute;left:8px;right:8px;top:8px;display:flex;justify-content:space-between;pointer-events:none}.hudGroup{display:flex;gap:5px}.stat{background:#050709b8;border:1px solid #3c4650;border-radius:8px;padding:5px 7px;min-width:58px;text-align:center}.stat small{display:block;color:#8f9aa4;font-size:8px}.stat b{font:10px ui-monospace}.gate{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:#030506dc;padding:20px}.gate[hidden]{display:none}.gateCard{width:min(92%,420px);padding:18px;border-radius:16px;border:1px solid #35414a;background:#0e1419;text-align:center}.gateCard h2{margin:0 0 8px;font-size:18px}.gateCard p{font-size:11px;color:#9ca8b1;line-height:1.5}.gateCard button{width:100%;min-height:48px;margin-top:8px;border:1px solid #ff715b;border-radius:10px;background:#e55645;color:#fff;font-weight:950}.gateCard button.secondary{background:#172028;border-color:#44515b}.bottom{z-index:4;padding:8px 10px max(10px,env(safe-area-inset-bottom));display:grid;gap:7px;background:#050709f3}.lens{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.lens button,.rig button,.actions button{border:1px solid #35414a;background:#11171c;color:#dce4e9;border-radius:9px;font-weight:900}.lens button{min-height:38px;font-size:12px}.lens button.on,.rig button.on{border-color:#ff715b;background:#4a211c;color:#fff}.rig{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.rig button{min-height:32px;font-size:10px}.actions{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:7px}.actions button{min-height:46px}.primary{background:#e55645!important;border-color:#ff715b!important}.note{font-size:9px;color:#77838d;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(orientation:landscape){.bottom{grid-template-columns:1fr 1fr 1.2fr}.note{grid-column:1/-1}}</style></head><body><div class="app"><div class="top"><div class="brand">FrisFrame · <b>DIRECTOR VIEWFINDER</b></div><div id="status" class="pill">READY</div></div><div class="view"><img id="feed" class="feed" alt="FrisFrame virtual camera view" src="/viewfinder.mjpeg?token=${encodeURIComponent(token)}"><video id="tracker" class="tracker" playsinline muted></video><div class="grid"></div><div class="center"></div><div class="hud"><div class="hudGroup"><div class="stat"><small>TRACK</small><b id="track">OFF</b></div><div class="stat"><small>CONF</small><b id="flow">0%</b></div></div><div class="hudGroup"><div class="stat"><small>LENS</small><b id="lensHud">35mm</b></div><div class="stat"><small>POSE</small><b id="pose">0°/0°</b></div></div></div><div id="gate" class="gate"><div class="gateCard"><h2>가상 카메라 시작</h2><p>센서와 후면 카메라 권한은 이 버튼을 누른 뒤에만 요청합니다. 지원되는 Android 기기는 별도 6DoF 버튼으로 실제 local-space 이동을 켤 수 있습니다.</p><button id="startBtn">START CAMERA</button><button id="xrBtn" class="secondary" hidden>START 6DoF</button></div></div></div><div class="bottom"><div class="lens"><button data-focal-mm="24">24mm</button><button data-focal-mm="35" class="on">35mm</button><button data-focal-mm="50">50mm</button><button data-focal-mm="85">85mm</button></div><div class="rig"><button data-rig="raw">RAW</button><button data-rig="handheld" class="on">HANDHELD</button><button data-rig="heavy">HEAVY</button></div><div class="actions"><button id="centerBtn">RECENTER</button><button id="rec" class="primary">● REC</button><button id="stop">■ STOP</button></div><div id="note" class="note">START CAMERA를 눌러 센서를 시작하세요.</div></div></div><script>(()=>{"use strict";const TOKEN=${safeToken},$=id=>document.getElementById(id),W=96,H=72,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=W;canvas.height=H;let stream=null,trackTimer=null,previous=null,previousOrientation=null,seq=0,calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,selectedFocalMm=35,rigProfile="handheld",pendingCommand=null,sending=false,alive=true;const raw={enabled:false,screenAngle:0,orientation:{alpha:0,beta:0,gamma:0,absolute:false},acceleration:{x:0,y:0,z:0},visual:{x:0,y:0,z:0,confidence:0,metric:false},spatial:{mode:"none",metric:false,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:0}};const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));const wrap=v=>{let n=(Number(v)||0)%360;if(n>180)n-=360;if(n<=-180)n+=360;return n};const angleStep=(a,b)=>wrap((Number(b)||0)-(Number(a)||0));const delay=ms=>new Promise(r=>setTimeout(r,ms));function setStatus(text,kind=""){const n=$("status");n.textContent=text;n.className="pill"+(kind?" "+kind:"")}function screenAngle(){return Number(screen.orientation?.angle??window.orientation??0)||0}function remapOrientation(value,screen){const a=Number(value.alpha)||0,b=Number(value.beta)||0,g=Number(value.gamma)||0,s=((Math.round((Number(screen)||0)/90)*90)%360+360)%360;if(s===90)return{yaw:a,pitch:-g};if(s===270)return{yaw:a,pitch:g};if(s===180)return{yaw:a,pitch:-b};return{yaw:a,pitch:b}}function onOrientation(e){raw.screenAngle=screenAngle();raw.orientation={alpha:clamp(e.alpha,-360,360),beta:clamp(e.beta,-180,180),gamma:clamp(e.gamma,-90,90),absolute:Boolean(e.absolute)};$("pose").textContent=Math.round(raw.orientation.alpha||0)+"°/"+Math.round(raw.orientation.beta||0)+"°"}function onMotion(e){const a=e.acceleration||{};raw.acceleration={x:clamp(a.x,-100,100),y:clamp(a.y,-100,100),z:clamp(a.z,-100,100)}}function grayFrame(){ctx.drawImage($("tracker"),0,0,W,H);const rgba=ctx.getImageData(0,0,W,H).data,out=new Uint8Array(W*H);for(let i=0,j=0;i<rgba.length;i+=4,j++)out[j]=(rgba[i]*3+rgba[i+1]*6+rgba[i+2])/10;return out}function px(frame,x,y){const ix=Math.max(0,Math.min(W-1,Math.round(x))),iy=Math.max(0,Math.min(H-1,Math.round(y)));return frame[iy*W+ix]}function score(prev,cur,dx,dy,scale){const cx=(W-1)/2,cy=(H-1)/2;let total=0,count=0;for(let y=8;y<H-8;y+=4)for(let x=8;x<W-8;x+=4){const sx=cx+(x-cx)/scale+dx,sy=cy+(y-cy)/scale+dy;if(sx<1||sx>=W-1||sy<1||sy>=H-1)continue;total+=Math.abs(cur[y*W+x]-px(prev,sx,sy));count++}return count?total/count:255}function estimate(prev,cur){const baseline=score(prev,cur,0,0,1);let best={dx:0,dy:0,scale:1,score:baseline,objective:baseline};for(const scale of [.965,.982,1,1.018,1.035])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const s=score(prev,cur,dx,dy,scale),objective=s+Math.abs(scale-1)*.22+(Math.abs(dx)+Math.abs(dy))*.002;if(objective<best.objective)best={dx,dy,scale,score:s,objective}}const improvement=Math.max(0,baseline-best.score),confidence=baseline>1?clamp(improvement/(baseline+1)*5.5,0,1):0;return{...best,baseline,confidence}}function rotationCompensatedResidual(flow,prevOri,nextOri){const yaw=Math.abs(angleStep(prevOri.yaw,nextOri.yaw)),pitch=Math.abs((Number(nextOri.pitch)||0)-(Number(prevOri.pitch)||0));const rotationalX=Math.min(4,yaw*(W/68)),rotationalY=Math.min(4,pitch*(H/52));return{dx:Math.sign(flow.dx)*Math.max(0,Math.abs(flow.dx)-rotationalX),dy:Math.sign(flow.dy)*Math.max(0,Math.abs(flow.dy)-rotationalY)}}function track(){if(!raw.enabled||raw.spatial.mode==="webxr"||!$("tracker").videoWidth)return;const current=grayFrame(),orientation=remapOrientation(raw.orientation,raw.screenAngle);if(previous&&previousOrientation){const t=estimate(previous,current),r=rotationCompensatedResidual(t,previousOrientation,orientation);if(t.confidence>=.16){raw.visual.x=clamp(raw.visual.x+clamp(-r.dx/(W*.1),-1,1)*.10,-8,8);raw.visual.y=clamp(raw.visual.y+clamp(r.dy/(H*.1),-1,1)*.10,-8,8);raw.visual.z=clamp(raw.visual.z+clamp((t.scale-1)/.035,-1,1)*.10,-8,8)}raw.visual.confidence=t.confidence;$("flow").textContent=Math.round(t.confidence*100)+"%"}previous=current;previousOrientation=orientation}async function permission(Ctor){if(typeof Ctor?.requestPermission==="function"){const result=await Ctor.requestPermission();if(result!=="granted")throw new Error("센서 권한이 거부되었습니다.")}}function stopTracker(){stream?.getTracks?.().forEach(t=>t.stop());stream=null;$("tracker").srcObject=null;if(trackTimer)clearInterval(trackTimer);trackTimer=null;previous=null;previousOrientation=null}async function startCameraFromGesture(){try{await Promise.all([permission(window.DeviceOrientationEvent),permission(window.DeviceMotionEvent)]);window.removeEventListener("deviceorientation",onOrientation,true);window.removeEventListener("devicemotion",onMotion,true);window.addEventListener("deviceorientation",onOrientation,true);window.addEventListener("devicemotion",onMotion,true);stopTracker();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:960},height:{ideal:720}},audio:false});$("tracker").srcObject=stream;await $("tracker").play();raw.enabled=true;raw.spatial={mode:"none",metric:false,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:0};trackTimer=setInterval(track,66);recenter();$("gate").hidden=true;$("track").textContent="FLOW";setStatus(rigProfile.toUpperCase(),"ok");$("note").textContent="Visual Flow는 회전 성분을 제거한 상대 이동만 사용합니다."}catch(error){setStatus("권한 필요","warn");$("note").textContent=String(error?.message||error);$("gate").hidden=false}}function recenter(){calibrationId++;raw.visual={x:0,y:0,z:0,confidence:0,metric:false};previous=null;previousOrientation=null}async function probeXR(){try{if(await navigator.xr?.isSessionSupported?.("immersive-ar"))$("xrBtn").hidden=false}catch{}}function xrFrame(_time,frame){if(!xrSpace)return;const pose=frame.getViewerPose(xrSpace);if(pose){const p=pose.transform.position,o=pose.transform.orientation;raw.spatial={mode:"webxr",metric:true,position:{x:p.x,y:p.y,z:p.z},orientation:{x:o.x,y:o.y,z:o.z,w:o.w},confidence:1};raw.enabled=true;$("flow").textContent="100%";$("track").textContent="6DoF"}frame.session.requestAnimationFrame(xrFrame)}async function startXRFromGesture(){try{if(!navigator.xr?.isSessionSupported||!(await navigator.xr.isSessionSupported("immersive-ar")))throw new Error("이 브라우저는 WebXR 6DoF를 지원하지 않습니다.");stopTracker();const c=document.createElement("canvas");xrGl=c.getContext("webgl",{alpha:true,xrCompatible:true});if(!xrGl)throw new Error("WebGL XR 컨텍스트를 만들 수 없습니다.");if(xrGl.makeXRCompatible)await xrGl.makeXRCompatible();xrSession=await navigator.xr.requestSession("immersive-ar",{optionalFeatures:["local-floor","dom-overlay"],domOverlay:{root:document.body}});xrSession.updateRenderState({baseLayer:new XRWebGLLayer(xrSession,xrGl)});xrSpace=await xrSession.requestReferenceSpace("local");raw.enabled=true;raw.visual={x:0,y:0,z:0,confidence:0,metric:false};recenter();xrSession.addEventListener("end",()=>{xrSession=null;xrSpace=null;raw.spatial={mode:"none",metric:false,position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},confidence:0};$("track").textContent="OFF";$("gate").hidden=false;setStatus("READY")});xrSession.requestAnimationFrame(xrFrame);$("gate").hidden=true;setStatus("6DoF","ok")}catch(error){$("gate").hidden=false;setStatus("6DoF 실패","warn");$("note").textContent=String(error?.message||error)}}function newCommand(type){pendingCommand={id:"cmd_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),type}}async function sendOnce(){seq++;const cmd=pendingCommand;const payload={seq,sentAt:Date.now(),command:cmd?.type||"",commandId:cmd?.id||"",focalMm:selectedFocalMm,rigProfile,motion:{...raw,calibrationId,focalMm:selectedFocalMm,rigProfile}};const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});if(!res.ok)throw new Error(String(res.status));const ack=await res.json();if(cmd&&ack.ack===cmd.id)pendingCommand=null;return ack}async function sendLoop(){if(sending)return;sending=true;while(alive){try{await sendOnce();if(raw.enabled)setStatus(raw.spatial.mode==="webxr"?"6DoF":rigProfile.toUpperCase(),"ok")}catch{setStatus("연결 끊김","warn")}await delay(24)}sending=false}document.querySelectorAll("[data-focal-mm]").forEach(b=>b.addEventListener("click",()=>{selectedFocalMm=Number(b.dataset.focalMm)||35;$("lensHud").textContent=selectedFocalMm+"mm";document.querySelectorAll("[data-focal-mm]").forEach(n=>n.classList.toggle("on",n===b))}));document.querySelectorAll("[data-rig]").forEach(b=>b.addEventListener("click",()=>{rigProfile=b.dataset.rig||"handheld";document.querySelectorAll("[data-rig]").forEach(n=>n.classList.toggle("on",n===b));setStatus(rigProfile.toUpperCase(),raw.enabled?"ok":"")}));$("startBtn").addEventListener("click",startCameraFromGesture);$("xrBtn").addEventListener("click",startXRFromGesture);$("centerBtn").addEventListener("click",recenter);$("rec").addEventListener("click",()=>newCommand("toggle-record"));$("stop").addEventListener("click",()=>newCommand("stop"));probeXR();sendLoop();window.addEventListener("pagehide",()=>{alive=false;stopTracker();try{xrSession?.end?.()}catch{}})})();</script></body></html>`;
}

function createPhoneMotionBridge({ getWindow, writeLog = () => {}, tlsDirectory } = {}) {
  let httpServer = null;
  let httpsServer = null;
  let httpPort = 0;
  let httpsPort = 0;
  let token = "";
  let tls = null;
  let lastInputAt = 0;
  let pendingInput = null;
  let dispatchTimer = null;
  let lastDispatchAt = 0;
  let lastAcceptedSeq = 0;
  let capturePromise = null;
  let lastFrame = null;
  let lastFrameAt = 0;
  const streamClients = new Set();
  const commandAcks = new Map();
  let patchedWebContentsId = null;

  function authorized(requestUrl) {
    try {
      const supplied = new URL(requestUrl, "http://127.0.0.1").searchParams.get("token") || "";
      const expected = Buffer.from(token), received = Buffer.from(supplied);
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    } catch { return false; }
  }

  function cleanupCommandAcks(now = Date.now()) {
    for (const [id, at] of commandAcks) if (now - at > COMMAND_CACHE_MS) commandAcks.delete(id);
  }

  async function ensureRendererPatches(window) {
    const id = window?.webContents?.id ?? null;
    if (id != null && patchedWebContentsId === id) return;
    for (const filename of ["phone-motion-core-absolute-focal.js", "phone-handheld-command-ux.js"]) {
      const source = fs.readFileSync(path.join(__dirname, filename), "utf8");
      await window.webContents.executeJavaScript(source, true);
    }
    patchedWebContentsId = id;
  }

  async function dispatchPayload(payload) {
    const window = typeof getWindow === "function" ? getWindow() : null;
    if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return false;
    await ensureRendererPatches(window);
    const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
    await window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input",{detail:${serialized}}));`, true);
    return true;
  }

  function dispatchNow() {
    dispatchTimer = null;
    if (!pendingInput) return;
    const payload = pendingInput;
    pendingInput = null;
    lastDispatchAt = Date.now();
    dispatchPayload(payload).catch((error) => writeLog(`director viewfinder input dispatch failed: ${error.stack || error}`));
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

  async function cameraFrameRect(window) {
    try {
      return await window.webContents.executeJavaScript(`(()=>{const el=document.getElementById("cameraFrameCanvas")||document.getElementById("cameraFrame");if(!el)return null;const r=el.getBoundingClientRect();return r.width>2&&r.height>2?{x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.max(2,Math.round(r.width)),height:Math.max(2,Math.round(r.height))}:null})()`, true);
    } catch { return null; }
  }

  async function captureViewfinderFrame() {
    const now = Date.now();
    if (lastFrame && now - lastFrameAt < VIEWFINDER_INTERVAL_MS) return lastFrame;
    if (capturePromise) return capturePromise;
    capturePromise = (async () => {
      const window = typeof getWindow === "function" ? getWindow() : null;
      if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return lastFrame;
      const rect = await cameraFrameRect(window);
      const image = await window.webContents.capturePage(rect || undefined);
      if (!image || image.isEmpty?.()) return lastFrame;
      let output = image;
      const size = image.getSize?.() || { width:0, height:0 };
      if (size.width > VIEWFINDER_MAX_WIDTH && typeof image.resize === "function") output = image.resize({ width:VIEWFINDER_MAX_WIDTH, quality:"good" });
      const jpeg = output.toJPEG(VIEWFINDER_JPEG_QUALITY);
      if (jpeg?.length) { lastFrame = jpeg; lastFrameAt = Date.now(); }
      return lastFrame;
    })().catch((error) => { writeLog(`director viewfinder capture failed: ${error.stack || error}`); return lastFrame; }).finally(() => { capturePromise = null; });
    return capturePromise;
  }

  function streamViewfinder(response) {
    response.writeHead(200, {"content-type":"multipart/x-mixed-replace; boundary=frisframeframe","cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","connection":"keep-alive","x-content-type-options":"nosniff"});
    const client = { response, closed:false };
    streamClients.add(client);
    response.on("close", () => { client.closed = true; streamClients.delete(client); });
    response.on("error", () => { client.closed = true; streamClients.delete(client); });
  }

  let streamPumpRunning = false;
  async function pumpStreams() {
    if (streamPumpRunning) return;
    streamPumpRunning = true;
    while (streamClients.size) {
      const started = Date.now();
      const frame = await captureViewfinderFrame();
      if (frame?.length) {
        const header = Buffer.from(`--frisframeframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`, "utf8");
        const tail = Buffer.from("\r\n", "utf8");
        for (const client of [...streamClients]) {
          if (client.closed || client.response.destroyed) { streamClients.delete(client); continue; }
          try { client.response.write(header); client.response.write(frame); client.response.write(tail); }
          catch { client.closed = true; streamClients.delete(client); }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(8, VIEWFINDER_INTERVAL_MS - (Date.now() - started))));
    }
    streamPumpRunning = false;
  }

  function handleRequest(request, response, secure) {
    const requestUrl = request.url || "/";
    if (!authorized(requestUrl)) { jsonResponse(response, 403, { error:"pairing-token-required" }); return; }
    const parsed = new URL(requestUrl, "http://127.0.0.1");
    if (request.method === "GET" && parsed.pathname === "/") { htmlResponse(response, secure ? motionHtml(token) : bootstrapHtml(token, secureUrl(request), tls?.fingerprintSha256, tls?.error)); return; }
    if (request.method === "GET" && parsed.pathname === "/ca.cer" && !secure && tls?.available) { response.writeHead(200, {"content-type":"application/x-x509-ca-cert","content-disposition":"attachment; filename=FrisFrame-Director-Viewfinder-CA.crt","content-length":tls.ca.length,"cache-control":"no-store","x-content-type-options":"nosniff"}); response.end(tls.ca); return; }
    if (request.method === "GET" && parsed.pathname === "/viewfinder.mjpeg" && secure) { streamViewfinder(response); pumpStreams(); return; }
    if (request.method === "GET" && parsed.pathname === "/status") { jsonResponse(response, 200, {ok:true,secure,lastInputAt,viewfinderClients:streamClients.size,virtualFeed:true,lastAcceptedSeq}); return; }
    if (request.method !== "POST" || parsed.pathname !== "/input") { jsonResponse(response, 404, {error:"not-found"}); return; }
    readJson(request,response,async(body)=>{
      const input=sanitizeMotionInput(body);lastInputAt=Date.now();cleanupCommandAcks(lastInputAt);
      const payload={...input,receivedAt:lastInputAt};
      if (input.command && input.commandId && commandAcks.has(input.commandId)) { jsonResponse(response,200,{ok:true,ack:input.commandId,duplicate:true,seq:input.seq}); return; }
      if (!input.command && input.seq <= lastAcceptedSeq) { jsonResponse(response,200,{ok:true,stale:true,seq:input.seq,lastAcceptedSeq}); return; }
      lastAcceptedSeq=Math.max(lastAcceptedSeq,input.seq);
      try {
        if (input.command) {
          await dispatchPayload(payload);
          if (input.commandId) commandAcks.set(input.commandId,lastInputAt);
        } else scheduleDispatch(payload);
        jsonResponse(response,200,{ok:true,ack:input.commandId||null,seq:input.seq,lastAcceptedSeq});
      } catch(error) {
        writeLog(`director viewfinder command dispatch failed: ${error.stack || error}`);
        jsonResponse(response,503,{ok:false,error:"renderer-unavailable",seq:input.seq});
      }
    });
  }

  function listen(server) { return new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"0.0.0.0",()=>{server.off("error",reject);resolve(Number(server.address()?.port)||0);});}); }

  async function start() {
    if (httpServer) return getConfig();
    token = crypto.randomBytes(24).toString("base64url");
    lastAcceptedSeq = 0; commandAcks.clear();
    const addresses = privateIpv4Addresses();
    tls = tryEnsureTlsMaterial({directory:tlsDirectory,hosts:addresses});
    httpServer = http.createServer((req,res)=>handleRequest(req,res,false));
    httpPort = await listen(httpServer);
    if (tls.available) {
      try { httpsServer = https.createServer({key:tls.key,cert:tls.cert},(req,res)=>handleRequest(req,res,true)); httpsPort = await listen(httpsServer); }
      catch (error) { writeLog(`director viewfinder HTTPS failed: ${error.stack || error}`); try{httpsServer?.close();}catch{} httpsServer=null;httpsPort=0;tls={...tls,available:false,error:String(error?.message||error)}; }
    }
    writeLog(`phone director viewfinder ready http=${httpPort} https=${httpsPort || "unavailable"}`);
    return getConfig();
  }

  function stop() {
    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null;pendingInput=null;commandAcks.clear();lastAcceptedSeq=0;patchedWebContentsId=null;
    for (const client of [...streamClients]) { try { client.response.end(); } catch {} client.closed = true; }
    streamClients.clear();
    for (const server of [httpServer,httpsServer]) if (server) try { server.close(); } catch {}
    httpServer=null;httpsServer=null;httpPort=0;httpsPort=0;lastFrame=null;lastFrameAt=0;
  }

  function getConfig() {
    if (!httpServer || !httpPort) return null;
    const addresses = privateIpv4Addresses();
    return { pairingCode:token.slice(0,6).toUpperCase(), bootstrapUrls:addresses.map((address)=>`http://${address}:${httpPort}/?token=${encodeURIComponent(token)}`), secureUrls:httpsPort&&tls?.available?addresses.map((address)=>`https://${address}:${httpsPort}/?token=${encodeURIComponent(token)}`):[], tls:{available:Boolean(httpsPort&&tls?.available),fingerprintSha256:tls?.fingerprintSha256||null,error:tls?.error||null}, hasLanAddress:addresses.length>0,lastInputAt,directorViewfinder:true,virtualFeed:true,viewfinderFps:Math.round(1000/VIEWFINDER_INTERVAL_MS),absoluteLensPresets:[24,35,50,85],commandAck:true,userGestureStart:true };
  }

  return { start, stop, getConfig };
}

module.exports = { createPhoneMotionBridge, sanitizeMotionInput, bootstrapHtml, motionHtml };
