from pathlib import Path

path = Path('electron/phone-director-viewfinder.cjs')
s = path.read_text()

def rep(old, new, count=1):
    global s
    found = s.count(old)
    if found < count:
        raise SystemExit(f'missing patch target: {old[:120]!r} found={found}')
    s = s.replace(old, new, count)

rep('const VIEWFINDER_TELEMETRY_INTERVAL_MS = 750;', 'const VIEWFINDER_TELEMETRY_INTERVAL_MS = 200;')

marker = '''function sanitizeCommandId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : "";
}
'''
addition = marker + '''
function normalizeDirectorStatus(value = {}) {
  const modeValue = String(value.mode || "idle");
  const mode = ["idle", "armed", "recording"].includes(modeValue) ? modeValue : "idle";
  const playheadSeconds = clamp(value.playheadSeconds, 0, 24 * 60 * 60);
  const durationSeconds = clamp(value.durationSeconds, 0, 24 * 60 * 60);
  const focalValue = Number(value.focalMm);
  const focalMm = Number.isFinite(focalValue) ? clamp(focalValue, 8, 300) : 35;
  const sourceRig = String(value.rigProfile || "handheld");
  const rigProfile = sourceRig === "cinema" ? "heavy" : (ALLOWED_RIGS.has(sourceRig) ? sourceRig : "handheld");
  return {
    mode,
    recording: mode === "recording",
    standby: mode === "armed",
    playheadSeconds: durationSeconds > 0 ? Math.min(playheadSeconds, durationSeconds) : playheadSeconds,
    durationSeconds,
    focalMm,
    rigProfile,
    connected: value.connected === true,
  };
}
'''
rep(marker, addition)

rep('.note{font-size:9px;color:#77838d;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(orientation:landscape)', '.note{font-size:9px;color:#77838d;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recordStrip{position:absolute;z-index:3;left:50%;bottom:10px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid #44515b;border-radius:999px;background:#050709cf;font:10px ui-monospace;pointer-events:none}.recordStrip b{min-width:32px}.recordStrip.rec{border-color:#ff5f55;background:#3b1010e6}.recordStrip.rec b{color:#ff8d85}.recordStrip.stby{border-color:#8a652d;background:#2a2110e6}.recordStrip.stby b{color:#ffd18a}.recordStrip small{color:#8996a1;font-size:8px}.actions button.recording{box-shadow:0 0 0 2px #ff5f5555 inset}@media(orientation:landscape)')

gate = '    <div id="gate" class="gate"><div class="gateCard"><h2>가상 카메라 시작</h2><p>센서와 후면 카메라 권한은 이 버튼을 누른 뒤에만 요청합니다. 지원되는 Android 기기는 별도 6DoF 버튼으로 실제 local-space 이동을 켤 수 있습니다.</p><button id="startBtn">START CAMERA</button><button id="xrBtn" class="secondary" hidden>START 6DoF</button></div></div>\n'
rec_strip = '    <div id="recordStrip" class="recordStrip"><b id="recordState">LIVE</b><span id="timecode">00:00:00:00</span><small id="ackHud">—</small></div>\n' + gate
rep(gate, rec_strip)

rep('let stream=null,trackTimer=null,telemetryTimer=null,previous=null,previousOrientation=null,seq=0,calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,selectedFocalMm=35,rigProfile="handheld",pendingCommand=null,sending=false,alive=true;', 'let stream=null,trackTimer=null,telemetryTimer=null,previous=null,previousOrientation=null,seq=0,calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,selectedFocalMm=35,rigProfile="handheld",pendingCommand=null,sending=false,alive=true,lastLocalControlAt=0;\nconst directorSync={mode:"idle",playheadSeconds:0,durationSeconds:0,focalMm:35,rigProfile:"handheld",connected:false,syncedAt:performance.now(),lastAck:null};')

status_fn = 'function setStatus(text,kind=""){const n=$("status");n.textContent=text;n.className="pill"+(kind?" "+kind:"")}\n'
director_fns = status_fn + '''function formatTimecode(seconds){const fps=30,total=Math.max(0,Math.floor((Number(seconds)||0)*fps+1e-6)),ff=total%fps,whole=Math.floor(total/fps),ss=whole%60,mm=Math.floor(whole/60)%60,hh=Math.floor(whole/3600);return [hh,mm,ss,ff].map(v=>String(v).padStart(2,"0")).join(":")}
function directorPlayheadNow(){const elapsed=directorSync.mode==="recording"?Math.max(0,performance.now()-directorSync.syncedAt)/1000:0;const value=directorSync.playheadSeconds+elapsed;return directorSync.durationSeconds>0?Math.min(value,directorSync.durationSeconds):value}
function syncDirectorControls(){if(performance.now()-lastLocalControlAt<350)return;const focal=Number(directorSync.focalMm);if(Number.isFinite(focal)){selectedFocalMm=focal;$("lensHud").textContent=Math.round(focal)+"mm";document.querySelectorAll("[data-focal-mm]").forEach(n=>n.classList.toggle("on",Math.abs(Number(n.dataset.focalMm)-focal)<.5))}if(["raw","handheld","heavy"].includes(directorSync.rigProfile)){rigProfile=directorSync.rigProfile;document.querySelectorAll("[data-rig]").forEach(n=>n.classList.toggle("on",n.dataset.rig===rigProfile))}}
function applyDirectorStatus(data,rttMs=0){const d=data?.director||{};directorSync.mode=["idle","armed","recording"].includes(d.mode)?d.mode:"idle";directorSync.playheadSeconds=Math.max(0,Number(d.playheadSeconds)||0);directorSync.durationSeconds=Math.max(0,Number(d.durationSeconds)||0);directorSync.focalMm=Number(d.focalMm)||selectedFocalMm;directorSync.rigProfile=String(d.rigProfile||rigProfile);directorSync.connected=d.connected===true;directorSync.syncedAt=performance.now()-Math.max(0,Number(rttMs)||0)/2;directorSync.lastAck=data?.lastCommandAck||directorSync.lastAck;syncDirectorControls();if(directorSync.lastAck?.command){const label=directorSync.lastAck.command==="toggle-record"?"REC":directorSync.lastAck.command.toUpperCase();$("ackHud").textContent="ACK "+label}}
function renderDirectorHud(){const mode=directorSync.mode,strip=$("recordStrip");$("recordState").textContent=mode==="recording"?"REC":(mode==="armed"?"STBY":"LIVE");$("timecode").textContent=formatTimecode(directorPlayheadNow());strip.className="recordStrip"+(mode==="recording"?" rec":(mode==="armed"?" stby":""));$("rec").classList.toggle("recording",mode==="recording");requestAnimationFrame(renderDirectorHud)}
'''
rep(status_fn, director_fns)

old_send = 'async function sendOnce(){seq++;const cmd=pendingCommand;const payload={seq,sentAt:Date.now(),command:cmd?.type||"",commandId:cmd?.id||"",focalMm:selectedFocalMm,rigProfile,motion:{...raw,calibrationId,focalMm:selectedFocalMm,rigProfile}};const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});if(!res.ok)throw new Error(String(res.status));const ack=await res.json();if(cmd&&ack.ack===cmd.id)pendingCommand=null;return ack}\n'
new_send = 'async function sendOnce(){seq++;const cmd=pendingCommand;const payload={seq,sentAt:Date.now(),command:cmd?.type||"",commandId:cmd?.id||"",focalMm:selectedFocalMm,rigProfile,motion:{...raw,calibrationId,focalMm:selectedFocalMm,rigProfile}};const res=await fetch("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});if(!res.ok)throw new Error(String(res.status));const ack=await res.json();if(cmd&&ack.ack===cmd.id){pendingCommand=null;directorSync.lastAck={id:cmd.id,command:cmd.type,at:Date.now()};const label=cmd.type==="toggle-record"?"REC":cmd.type.toUpperCase();$("ackHud").textContent="ACK "+label}return ack}\n'
rep(old_send, new_send)

old_poll = 'async function pollLinkTelemetry(){const started=Date.now();try{const res=await fetch("/status?token="+encodeURIComponent(TOKEN),{cache:"no-store"});if(!res.ok)throw new Error(String(res.status));const data=await res.json(),finished=Date.now(),midpoint=(started+finished)/2,clockOffset=(Number(data.serverNow)||finished)-midpoint,frameAt=Number(data.lastFrameAt)||0,estimatedAge=frameAt?Math.max(0,Math.round(finished-frameAt+clockOffset)):0;$("latency").textContent=frameAt?estimatedAge+"ms":"—";$("vfFps").textContent=Number(data.measuredFps)>0?Number(data.measuredFps).toFixed(0):"—";if((Number(data.droppedFrames)||0)>0)$("note").textContent="지연 시 오래된 프레임을 버리고 최신 프레임을 우선 표시합니다."}catch{$("latency").textContent="—";$("vfFps").textContent="—"}}\n'
new_poll = 'async function pollLinkTelemetry(){const started=Date.now(),startedPerf=performance.now();try{const res=await fetch("/status?token="+encodeURIComponent(TOKEN),{cache:"no-store"});if(!res.ok)throw new Error(String(res.status));const data=await res.json(),finished=Date.now(),finishedPerf=performance.now(),midpoint=(started+finished)/2,clockOffset=(Number(data.serverNow)||finished)-midpoint,frameAt=Number(data.lastFrameAt)||0,estimatedAge=frameAt?Math.max(0,Math.round(finished-frameAt+clockOffset)):0;$("latency").textContent=frameAt?estimatedAge+"ms":"—";$("vfFps").textContent=Number(data.measuredFps)>0?Number(data.measuredFps).toFixed(0):"—";applyDirectorStatus(data,finishedPerf-startedPerf);if((Number(data.droppedFrames)||0)>0)$("note").textContent="지연 시 오래된 프레임을 버리고 최신 프레임을 우선 표시합니다."}catch{$("latency").textContent="—";$("vfFps").textContent="—"}}\n'
rep(old_poll, new_poll)

rep('document.querySelectorAll("[data-focal-mm]").forEach(b=>b.addEventListener("click",()=>{selectedFocalMm=Number(b.dataset.focalMm)||35;', 'document.querySelectorAll("[data-focal-mm]").forEach(b=>b.addEventListener("click",()=>{lastLocalControlAt=performance.now();selectedFocalMm=Number(b.dataset.focalMm)||35;')
rep('document.querySelectorAll("[data-rig]").forEach(b=>b.addEventListener("click",()=>{rigProfile=b.dataset.rig||"handheld";', 'document.querySelectorAll("[data-rig]").forEach(b=>b.addEventListener("click",()=>{lastLocalControlAt=performance.now();rigProfile=b.dataset.rig||"handheld";')
rep('probeXR();sendLoop();pollLinkTelemetry();telemetryTimer=setInterval(pollLinkTelemetry,${VIEWFINDER_TELEMETRY_INTERVAL_MS});', 'probeXR();sendLoop();pollLinkTelemetry();telemetryTimer=setInterval(pollLinkTelemetry,${VIEWFINDER_TELEMETRY_INTERVAL_MS});requestAnimationFrame(renderDirectorHud);')

rep('  const commandAcks = new Map();\n  let patchedWebContentsId = null;\n', '  const commandAcks = new Map();\n  let lastCommandAck = null;\n  let lastDirectorStatus = normalizeDirectorStatus({});\n  let lastDirectorStatusAt = 0;\n  let directorStatusPromise = null;\n  let patchedWebContentsId = null;\n')

ensure_marker = '  async function dispatchPayload(payload) {\n'
reader = '''  async function readRendererDirectorStatus() {
    const now = Date.now();
    if (now - lastDirectorStatusAt < 120) return lastDirectorStatus;
    if (directorStatusPromise) return directorStatusPromise;
    directorStatusPromise = (async () => {
      const window = typeof getWindow === "function" ? getWindow() : null;
      if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return lastDirectorStatus;
      await ensureRendererPatches(window);
      const raw = await window.webContents.executeJavaScript(`(()=>{try{const appState=typeof state!=="undefined"?state:null;const op=window.FrisFrameCameraOperator;const physical=window.FrisFramePhoneMotionCamera;return{mode:op?.mode||"idle",playheadSeconds:Number(appState?.motion?.playhead||0),durationSeconds:Number(appState?.motion?.duration||globalThis.MAX_TIMELINE_DURATION||60),focalMm:Number(appState?.camera?.focal||35),rigProfile:physical?.stabilization||"handheld",connected:Boolean(physical?.connected)}}catch{return null}})()`, true);
      lastDirectorStatus = normalizeDirectorStatus(raw || {});
      lastDirectorStatusAt = Date.now();
      return lastDirectorStatus;
    })().catch((error) => {
      writeLog(`director viewfinder status read failed: ${error.stack || error}`);
      return lastDirectorStatus;
    }).finally(() => { directorStatusPromise = null; });
    return directorStatusPromise;
  }

'''
rep(ensure_marker, reader + ensure_marker)

rep('  function statusPayload(secure) {\n', '  async function statusPayload(secure) {\n')
rep('    return {\n      ok:true,\n      secure,\n', '    const director = await readRendererDirectorStatus();\n    return {\n      ok:true,\n      secure,\n      director,\n      lastCommandAck:lastCommandAck ? { ...lastCommandAck } : null,\n')
rep('    if (request.method === "GET" && parsed.pathname === "/status") { jsonResponse(response, 200, statusPayload(secure)); return; }', '    if (request.method === "GET" && parsed.pathname === "/status") { statusPayload(secure).then((payload)=>jsonResponse(response,200,payload)).catch(()=>jsonResponse(response,503,{ok:false,error:"status-unavailable"})); return; }')
rep('          if (input.commandId) commandAcks.set(input.commandId,lastInputAt);', '          if (input.commandId) { commandAcks.set(input.commandId,lastInputAt); lastCommandAck={id:input.commandId,command:input.command,at:lastInputAt}; }')
rep('    lastAcceptedSeq = 0; commandAcks.clear();', '    lastAcceptedSeq = 0; commandAcks.clear(); lastCommandAck=null; lastDirectorStatus=normalizeDirectorStatus({}); lastDirectorStatusAt=0; directorStatusPromise=null;')
rep('    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null;pendingInput=null;commandAcks.clear();lastAcceptedSeq=0;patchedWebContentsId=null;', '    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null;pendingInput=null;commandAcks.clear();lastCommandAck=null;lastAcceptedSeq=0;lastDirectorStatus=normalizeDirectorStatus({});lastDirectorStatusAt=0;directorStatusPromise=null;patchedWebContentsId=null;')
rep('latencyTelemetry:true,absoluteLensPresets', 'latencyTelemetry:true,recordBackchannel:true,timecodeBackchannel:true,statusHz:Math.round(1000/VIEWFINDER_TELEMETRY_INTERVAL_MS),absoluteLensPresets')
rep('module.exports = { createPhoneMotionBridge, sanitizeMotionInput, bootstrapHtml, motionHtml };', 'module.exports = { createPhoneMotionBridge, sanitizeMotionInput, normalizeDirectorStatus, bootstrapHtml, motionHtml };')

path.write_text(s)

test_path = Path('tests/phone-motion-server.test.cjs')
t = test_path.read_text()
t = t.replace('const { sanitizeMotionInput, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");', 'const { sanitizeMotionInput, normalizeDirectorStatus, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");')
insert = r'''

test("director status normalization keeps REC state, timecode inputs, focal and rig bounded", () => {
  const value = normalizeDirectorStatus({
    mode:"recording",
    playheadSeconds:12.345,
    durationSeconds:60,
    focalMm:500,
    rigProfile:"cinema",
    connected:true,
  });
  assert.equal(value.mode,"recording");
  assert.equal(value.recording,true);
  assert.equal(value.standby,false);
  assert.equal(value.playheadSeconds,12.345);
  assert.equal(value.durationSeconds,60);
  assert.equal(value.focalMm,300);
  assert.equal(value.rigProfile,"heavy");
  assert.equal(value.connected,true);
});

test("phone Director Viewfinder renders renderer-backed REC STBY timecode and acknowledgement HUD", () => {
  const html = motionHtml("token");
  assert.match(html,/id="recordState">LIVE/);
  assert.match(html,/id="timecode">00:00:00:00/);
  assert.match(html,/id="ackHud">/);
  assert.match(html,/formatTimecode/);
  assert.match(html,/directorPlayheadNow/);
  assert.match(html,/applyDirectorStatus/);
  assert.match(html,/requestAnimationFrame\(renderDirectorHud\)/);
  assert.match(viewfinderServer,/VIEWFINDER_TELEMETRY_INTERVAL_MS = 200/);
});

test("status backchannel reads authoritative Camera Operator state and reports the latest command ACK", () => {
  assert.match(viewfinderServer,/async function readRendererDirectorStatus/);
  assert.match(viewfinderServer,/FrisFrameCameraOperator/);
  assert.match(viewfinderServer,/playheadSeconds:Number\(appState\?\.motion\?\.playhead/);
  assert.match(viewfinderServer,/focalMm:Number\(appState\?\.camera\?\.focal/);
  assert.match(viewfinderServer,/lastCommandAck/);
  assert.match(viewfinderServer,/recordBackchannel:true/);
  assert.match(viewfinderServer,/timecodeBackchannel:true/);
});
'''
needle = '\ntest("TLS SAN configuration includes localhost and LAN IPs", () => {'
if needle not in t:
    raise SystemExit('test insertion target missing')
t = t.replace(needle, insert + needle, 1)
test_path.write_text(t)
