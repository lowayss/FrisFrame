from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_one(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 exact match, got {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

def sub_one(path, pattern, repl):
    text = read(path)
    updated, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 regex match, got {count}: {pattern[:120]!r}')
    write(path, updated)

vf = 'electron/phone-director-viewfinder.cjs'
main = 'electron/main.cjs'
tests = 'tests/phone-motion-server.test.cjs'

replace_one(vf,
'''const VIEWFINDER_TELEMETRY_INTERVAL_MS = 200;\nconst COMMAND_CACHE_MS = 60 * 1000;''',
'''const VIEWFINDER_TELEMETRY_INTERVAL_MS = 200;\nconst COMMAND_APPLY_TIMEOUT_MS = 800;\nconst COMMAND_CACHE_MS = 60 * 1000;''')

replace_one(vf,
'''let stream=null,trackTimer=null,telemetryTimer=null,previous=null,previousOrientation=null,seq=0,calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,selectedFocalMm=35,rigProfile="handheld",pendingCommand=null,sending=false,alive=true,lastLocalControlAt=0;''',
'''let stream=null,trackTimer=null,telemetryTimer=null,previous=null,previousOrientation=null,seq=0,calibrationId=0,xrSession=null,xrSpace=null,xrGl=null,selectedFocalMm=35,rigProfile="handheld",pendingCommands=[],sending=false,telemetryInFlight=false,alive=true,lastLocalControlAt=0;''')

replace_one(vf,
'''const delay=ms=>new Promise(r=>setTimeout(r,ms));\nfunction setStatus''',
'''const delay=ms=>new Promise(r=>setTimeout(r,ms));\nconst INPUT_TIMEOUT_MS=900,STATUS_TIMEOUT_MS=700;\nasync function fetchWithTimeout(url,options={},timeoutMs=INPUT_TIMEOUT_MS){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}\nfunction setStatus''')

replace_one(vf,
'''function syncDirectorControls(){if(performance.now()-lastLocalControlAt<350)return;''',
'''function syncDirectorControls(){if(lastLocalControlAt>0&&performance.now()-lastLocalControlAt<350)return;''')

sub_one(vf,
    r'function applyDirectorStatus\(data,rttMs=0\)\{.*?\}\nfunction renderDirectorHud\(\)\{.*?\}\nfunction screenAngle',
'''function applyDirectorStatus(data,rttMs=0){const d=data?.director||{};directorSync.mode=["idle","armed","recording"].includes(d.mode)?d.mode:"idle";directorSync.playheadSeconds=Math.max(0,Number(d.playheadSeconds)||0);directorSync.durationSeconds=Math.max(0,Number(d.durationSeconds)||0);directorSync.focalMm=Number(d.focalMm)||selectedFocalMm;directorSync.rigProfile=String(d.rigProfile||rigProfile);directorSync.connected=d.connected===true;directorSync.syncedAt=performance.now()-Math.max(0,Number(rttMs)||0)/2;directorSync.lastAck=data?.lastCommandAck||null;syncDirectorControls();if(directorSync.lastAck?.command){const label=directorSync.lastAck.command==="toggle-record"?"REC":directorSync.lastAck.command.toUpperCase();$("ackHud").textContent="ACK "+label}else if(!pendingCommands.length)$("ackHud").textContent="—"}\nfunction renderDirectorHud(){const mode=directorSync.mode,linked=directorSync.connected||raw.enabled,strip=$("recordStrip");$("recordState").textContent=!linked?"OFF":(mode==="recording"?"REC":(mode==="armed"?"STBY":"LIVE"));$("timecode").textContent=formatTimecode(directorPlayheadNow());strip.className="recordStrip"+(mode==="recording"?" rec":(mode==="armed"?" stby":""));$("rec").classList.toggle("recording",mode==="recording");requestAnimationFrame(renderDirectorHud)}\nfunction screenAngle''')

sub_one(vf,
    r'function newCommand\(type\)\{.*?\}\nasync function sendOnce\(\)\{.*?\}\nasync function sendLoop\(\)\{.*?\}\nasync function pollLinkTelemetry\(\)\{.*?\}\n',
'''function commandLabel(type){return type==="toggle-record"?"REC":String(type||"").toUpperCase()}\nfunction removePendingCommand(id){if(!id)return;if(pendingCommands[0]?.id===id)pendingCommands.shift();else pendingCommands=pendingCommands.filter(item=>item.id!==id)}\nfunction newCommand(type){const next={id:"cmd_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),type};pendingCommands.push(next);if(pendingCommands.length>8)pendingCommands.shift();$("ackHud").textContent="SEND "+commandLabel(type)}\nasync function sendOnce(){seq++;const cmd=pendingCommands[0]||null;const payload={seq,sentAt:Date.now(),command:cmd?.type||"",commandId:cmd?.id||"",focalMm:selectedFocalMm,rigProfile,motion:{...raw,calibrationId,focalMm:selectedFocalMm,rigProfile}};const res=await fetchWithTimeout("/input?token="+encodeURIComponent(TOKEN),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"},INPUT_TIMEOUT_MS);const body=await res.json().catch(()=>({}));if(!res.ok){if(cmd&&body?.failedCommandId===cmd.id){removePendingCommand(cmd.id);directorSync.lastAck=null;$("ackHud").textContent="FAIL "+commandLabel(cmd.type)}throw new Error(String(res.status))}if(cmd&&body.ack===cmd.id){removePendingCommand(cmd.id);directorSync.lastAck={id:cmd.id,command:cmd.type,at:Date.now(),stage:"applied"};$("ackHud").textContent="ACK "+commandLabel(cmd.type)}return body}\nasync function sendLoop(){if(sending)return;sending=true;while(alive){try{await sendOnce();if(raw.enabled)setStatus(raw.spatial.mode==="webxr"?"6DoF":rigProfile.toUpperCase(),"ok")}catch{setStatus("연결 끊김","warn")}await delay(24)}sending=false}\nasync function pollLinkTelemetry(){if(telemetryInFlight)return;telemetryInFlight=true;const started=Date.now(),startedPerf=performance.now();try{const res=await fetchWithTimeout("/status?token="+encodeURIComponent(TOKEN),{cache:"no-store"},STATUS_TIMEOUT_MS);if(!res.ok)throw new Error(String(res.status));const data=await res.json(),finished=Date.now(),finishedPerf=performance.now(),midpoint=(started+finished)/2,clockOffset=(Number(data.serverNow)||finished)-midpoint,frameAt=Number(data.lastFrameAt)||0,estimatedAge=frameAt?Math.max(0,Math.round(finished-frameAt+clockOffset)):0;$("latency").textContent=frameAt?estimatedAge+"ms":"—";$("vfFps").textContent=Number(data.measuredFps)>0?Number(data.measuredFps).toFixed(0):"—";applyDirectorStatus(data,finishedPerf-startedPerf);if((Number(data.droppedFrames)||0)>0)$("note").textContent="지연 시 오래된 프레임을 버리고 최신 프레임을 우선 표시합니다."}catch{$("latency").textContent="—";$("vfFps").textContent="—"}finally{telemetryInFlight=false}}\n''')

replace_one(vf,
'''probeXR();sendLoop();pollLinkTelemetry();telemetryTimer=setInterval(pollLinkTelemetry,${VIEWFINDER_TELEMETRY_INTERVAL_MS});requestAnimationFrame(renderDirectorHud);''',
'''async function initialize(){probeXR();await pollLinkTelemetry();if(!alive)return;sendLoop();telemetryTimer=setInterval(pollLinkTelemetry,${VIEWFINDER_TELEMETRY_INTERVAL_MS});requestAnimationFrame(renderDirectorHud)}initialize();''')

replace_one(vf,
'''  const commandAcks = new Map();\n  let lastCommandAck = null;''',
'''  const commandAcks = new Map();\n  const commandRecords = new Map();\n  let lastCommandAck = null;''')

replace_one(vf,
'''  let directorStatusPromise = null;\n  let patchedWebContentsId = null;''',
'''  let directorStatusPromise = null;\n  let patchedRendererEpoch = null;''')

replace_one(vf,
'''  function cleanupCommandAcks(now = Date.now()) {\n    for (const [id, at] of commandAcks) if (now - at > COMMAND_CACHE_MS) commandAcks.delete(id);\n  }''',
'''  function cleanupCommandAcks(now = Date.now()) {\n    for (const [id, at] of commandAcks) if (now - at > COMMAND_CACHE_MS) commandAcks.delete(id);\n    for (const [id, record] of commandRecords) if (now - Number(record?.at || 0) > COMMAND_CACHE_MS) commandRecords.delete(id);\n    if (lastCommandAck && now - Number(lastCommandAck.at || 0) > 5000) lastCommandAck = null;\n  }''')

sub_one(vf,
    r'  async function ensureRendererPatches\(window\) \{.*?\n  \}\n\n  async function readRendererDirectorStatus\(\) \{.*?\n  \}\n',
'''  async function ensureRendererPatches(window) {\n    const id = window?.webContents?.id ?? null;\n    const timeOrigin = await window.webContents.executeJavaScript(`String(performance.timeOrigin || 0)`, true).catch(() => "");\n    const epoch = `${id}:${timeOrigin}`;\n    if (epoch && patchedRendererEpoch === epoch) return;\n    for (const filename of ["phone-motion-core-absolute-focal.js", "phone-handheld-command-ux.js"]) {\n      const source = fs.readFileSync(path.join(__dirname, filename), "utf8");\n      await window.webContents.executeJavaScript(source, true);\n    }\n    patchedRendererEpoch = epoch;\n  }\n\n  async function readRendererDirectorStatus(force = false) {\n    const now = Date.now();\n    if (!force && now - lastDirectorStatusAt < 120) return lastDirectorStatus;\n    if (directorStatusPromise) {\n      const current = await directorStatusPromise;\n      if (!force) return current;\n    }\n    directorStatusPromise = (async () => {\n      const window = typeof getWindow === "function" ? getWindow() : null;\n      if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return lastDirectorStatus;\n      await ensureRendererPatches(window);\n      const raw = await window.webContents.executeJavaScript(`(()=>{try{const appState=typeof state!=="undefined"?state:null;const op=window.FrisFrameCameraOperator;const physical=window.FrisFramePhoneMotionCamera;const live=physical?.livePreview;return{mode:op?.mode||"idle",playheadSeconds:Number(appState?.motion?.playhead||0),durationSeconds:Number(appState?.motion?.duration||globalThis.MAX_TIMELINE_DURATION||60),focalMm:Number(live?.focal ?? appState?.camera?.focal ?? 35),rigProfile:physical?.stabilization||"handheld",connected:Boolean(physical?.connected)}}catch{return null}})()`, true);\n      lastDirectorStatus = normalizeDirectorStatus(raw || {});\n      lastDirectorStatusAt = Date.now();\n      return lastDirectorStatus;\n    })().catch((error) => {\n      writeLog(`director viewfinder status read failed: ${error.stack || error}`);\n      return lastDirectorStatus;\n    }).finally(() => { directorStatusPromise = null; });\n    return directorStatusPromise;\n  }\n''')

replace_one(vf,
'''  async function dispatchPayload(payload) {\n    const window = typeof getWindow === "function" ? getWindow() : null;\n    if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return false;\n    await ensureRendererPatches(window);\n    const serialized = JSON.stringify(payload).replace(/</g, "\\\\u003c");\n    await window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input",{detail:${serialized}}));`, true);\n    return true;\n  }''',
'''  async function dispatchPayload(payload) {\n    const window = typeof getWindow === "function" ? getWindow() : null;\n    if (!window || window.isDestroyed?.() || window.webContents?.isDestroyed?.()) return false;\n    await ensureRendererPatches(window);\n    const serialized = JSON.stringify(payload).replace(/</g, "\\\\u003c");\n    await window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent("frisframe:phone-remote-input",{detail:${serialized}}));`, true);\n    return true;\n  }\n\n  function commandTransitionSatisfied(command, before = {}, after = {}) {\n    const beforeMode = String(before.mode || "idle");\n    const afterMode = String(after.mode || "idle");\n    if (command === "toggle-record") return beforeMode === "recording" ? afterMode !== "recording" : afterMode === "recording";\n    if (command === "stop" || command === "cancel") return afterMode === "idle";\n    return true;\n  }\n\n  async function waitForCommandApplied(command, before) {\n    const deadline = Date.now() + COMMAND_APPLY_TIMEOUT_MS;\n    let latest = await readRendererDirectorStatus(true);\n    while (!commandTransitionSatisfied(command, before, latest) && Date.now() < deadline) {\n      await new Promise((resolve) => setTimeout(resolve, 40));\n      latest = await readRendererDirectorStatus(true);\n    }\n    return { applied:commandTransitionSatisfied(command, before, latest), status:latest };\n  }''')

replace_one(vf,
'''      return await window.webContents.executeJavaScript(`(()=>{const el=document.getElementById("cameraFrameCanvas")||document.getElementById("cameraFrame");if(!el)return null;const r=el.getBoundingClientRect();return r.width>2&&r.height>2?{x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.max(2,Math.round(r.width)),height:Math.max(2,Math.round(r.height))}:null})()`, true);''',
'''      return await window.webContents.executeJavaScript(`(()=>{const el=document.getElementById("cameraFrameCanvas");if(!el)return null;const r=el.getBoundingClientRect();return r.width>2&&r.height>2?{x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.max(2,Math.round(r.width)),height:Math.max(2,Math.round(r.height))}:null})()`, true);''')

replace_one(vf,
'''      const rect = await cameraFrameRect(window);\n      const image = await window.webContents.capturePage(rect || undefined);''',
'''      const rect = await cameraFrameRect(window);\n      if (!rect) return lastFrame;\n      const image = await window.webContents.capturePage(rect);''')

sub_one(vf,
    r'    readJson\(request,response,async\(body\)=>\{.*?\n    \}\);\n',
'''    readJson(request,response,async(body)=>{\n      const input=sanitizeMotionInput(body);lastInputAt=Date.now();cleanupCommandAcks(lastInputAt);\n      const payload={...input,receivedAt:lastInputAt};\n      if (input.command && !input.commandId) { jsonResponse(response,400,{ok:false,error:"command-id-required",seq:input.seq}); return; }\n      if (input.command && input.commandId && commandAcks.has(input.commandId)) { jsonResponse(response,200,{ok:true,ack:input.commandId,stage:"applied",duplicate:true,seq:input.seq}); return; }\n      if (input.command && input.commandId && commandRecords.has(input.commandId)) {\n        const existing = commandRecords.get(input.commandId);\n        const result = await existing.promise;\n        if (result.applied) jsonResponse(response,200,{ok:true,ack:input.commandId,stage:"applied",duplicate:true,seq:input.seq,mode:result.status?.mode||"idle"});\n        else jsonResponse(response,result.statusCode||409,{ok:false,error:result.error||"command-not-applied",failedCommandId:input.commandId,seq:input.seq,mode:result.status?.mode||"idle"});\n        return;\n      }\n      if (!input.command && input.seq <= lastAcceptedSeq) { jsonResponse(response,200,{ok:true,stale:true,seq:input.seq,lastAcceptedSeq}); return; }\n      lastAcceptedSeq=Math.max(lastAcceptedSeq,input.seq);\n      try {\n        if (input.command) {\n          const before = await readRendererDirectorStatus(true);\n          const record = { at:lastInputAt, command:input.command, beforeMode:before.mode, promise:null };\n          record.promise = (async () => {\n            const dispatched = await dispatchPayload(payload);\n            if (!dispatched) return { applied:false,error:"renderer-unavailable",statusCode:503,status:before };\n            const applied = await waitForCommandApplied(input.command,before);\n            if (!applied.applied) return { applied:false,error:"command-not-applied",statusCode:409,status:applied.status };\n            return { applied:true,status:applied.status };\n          })();\n          commandRecords.set(input.commandId,record);\n          const result = await record.promise;\n          if (!result.applied) { jsonResponse(response,result.statusCode||409,{ok:false,error:result.error||"command-not-applied",failedCommandId:input.commandId,seq:input.seq,mode:result.status?.mode||"idle"}); return; }\n          commandAcks.set(input.commandId,lastInputAt);\n          lastCommandAck={id:input.commandId,command:input.command,at:lastInputAt,stage:"applied",mode:result.status?.mode||"idle"};\n          jsonResponse(response,200,{ok:true,ack:input.commandId,stage:"applied",seq:input.seq,lastAcceptedSeq,mode:result.status?.mode||"idle"});\n        } else {\n          scheduleDispatch(payload);\n          jsonResponse(response,200,{ok:true,ack:null,seq:input.seq,lastAcceptedSeq});\n        }\n      } catch(error) {\n        writeLog(`director viewfinder command dispatch failed: ${error.stack || error}`);\n        jsonResponse(response,503,{ok:false,error:"renderer-unavailable",failedCommandId:input.commandId||null,seq:input.seq});\n      }\n    });\n''')

replace_one(vf,
'''    const director = await readRendererDirectorStatus();\n    return {\n      ok:true,\n      secure,\n      director,\n      lastCommandAck:lastCommandAck ? { ...lastCommandAck } : null,''',
'''    const director = await readRendererDirectorStatus();\n    cleanupCommandAcks(Date.now());\n    return {\n      ok:true,\n      secure,\n      director,\n      lastCommandAck:lastCommandAck ? { ...lastCommandAck } : null,''')

replace_one(vf,
'''    lastAcceptedSeq = 0; commandAcks.clear(); lastCommandAck=null; lastDirectorStatus=normalizeDirectorStatus({}); lastDirectorStatusAt=0; directorStatusPromise=null;''',
'''    lastAcceptedSeq = 0; commandAcks.clear(); commandRecords.clear(); lastCommandAck=null; lastDirectorStatus=normalizeDirectorStatus({}); lastDirectorStatusAt=0; directorStatusPromise=null;''')

replace_one(vf,
'''    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null;pendingInput=null;commandAcks.clear();lastCommandAck=null;lastAcceptedSeq=0;lastDirectorStatus=normalizeDirectorStatus({});lastDirectorStatusAt=0;directorStatusPromise=null;patchedWebContentsId=null;''',
'''    if (dispatchTimer) clearTimeout(dispatchTimer); dispatchTimer=null;pendingInput=null;commandAcks.clear();commandRecords.clear();lastCommandAck=null;lastAcceptedSeq=0;lastDirectorStatus=normalizeDirectorStatus({});lastDirectorStatusAt=0;directorStatusPromise=null;patchedRendererEpoch=null;''')

replace_one(vf,
'''module.exports = { createPhoneMotionBridge, sanitizeMotionInput, normalizeDirectorStatus, bootstrapHtml, motionHtml };''',
'''module.exports = { createPhoneMotionBridge, sanitizeMotionInput, normalizeDirectorStatus, commandTransitionSatisfied, bootstrapHtml, motionHtml };''')

replace_one(main,
'''"camera-operator-inputs-ux.js", "phone-motion-core.js", "phone-motion-camera-ux.js", "camera-take-browser-ux.js"''',
'''"camera-operator-inputs-ux.js", "phone-motion-core.js", "phone-motion-core-absolute-focal.js", "phone-motion-camera-ux.js", "phone-handheld-command-ux.js", "camera-take-browser-ux.js"''')

replace_one(tests,
'''const { sanitizeMotionInput, normalizeDirectorStatus, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");''',
'''const { sanitizeMotionInput, normalizeDirectorStatus, commandTransitionSatisfied, bootstrapHtml, motionHtml } = require("../electron/phone-motion-server.cjs");''')

replace_one(tests,
'''const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));''',
'''const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));\nconst mainSource = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");''')

replace_one(tests,
'''test("viewfinder capture targets the clean camera canvas before its UI container", () => {\n  assert.match(viewfinderServer,/document\\.getElementById\\("cameraFrameCanvas"\\)\\|\\|document\\.getElementById\\("cameraFrame"\\)/);\n  assert.match(viewfinderServer,/webContents\\.capturePage/);\n  assert.match(viewfinderServer,/multipart\\/x-mixed-replace/);\n  assert.match(viewfinderServer,/authorized\\(requestUrl\\)/);\n});''',
'''test("viewfinder captures only the clean camera canvas and never falls back to the full window", () => {\n  assert.match(viewfinderServer,/document\\.getElementById\\("cameraFrameCanvas"\\)/);\n  assert.doesNotMatch(viewfinderServer,/cameraFrameCanvas"\\)\\|\\|document\\.getElementById\\("cameraFrame"/);\n  assert.match(viewfinderServer,/if \\(!rect\\) return lastFrame/);\n  assert.match(viewfinderServer,/capturePage\\(rect\\)/);\n  assert.doesNotMatch(viewfinderServer,/capturePage\\(rect \\|\\| undefined\\)/);\n  assert.match(viewfinderServer,/multipart\\/x-mixed-replace/);\n  assert.match(viewfinderServer,/authorized\\(requestUrl\\)/);\n});''')

replace_one(tests,
'''  assert.match(viewfinderServer,/focalMm:Number\\(appState\\?\\.camera\\?\\.focal/);''',
'''  assert.match(viewfinderServer,/focalMm:Number\\(live\\?\\.focal \\?\\? appState\\?\\.camera\\?\\.focal/);''')

append = r'''

test("REC STOP command queue keeps a newer STOP when an older REC acknowledgement returns", () => {
  const html = motionHtml("token");
  assert.match(html,/pendingCommands=\[\]/);
  assert.match(html,/const cmd=pendingCommands\[0\]\|\|null/);
  assert.match(html,/removePendingCommand\(cmd\.id\)/);
  assert.doesNotMatch(html,/pendingCommand=null/);
  assert.match(html,/pendingCommands\.push\(next\)/);
});

test("command acknowledgement is emitted only after the authoritative operator transition is applied", () => {
  assert.equal(commandTransitionSatisfied("toggle-record", {mode:"idle"}, {mode:"recording"}), true);
  assert.equal(commandTransitionSatisfied("toggle-record", {mode:"idle"}, {mode:"armed"}), false);
  assert.equal(commandTransitionSatisfied("toggle-record", {mode:"recording"}, {mode:"idle"}), true);
  assert.equal(commandTransitionSatisfied("stop", {mode:"recording"}, {mode:"idle"}), true);
  assert.equal(commandTransitionSatisfied("stop", {mode:"recording"}, {mode:"recording"}), false);
  assert.match(viewfinderServer,/waitForCommandApplied/);
  assert.match(viewfinderServer,/stage:"applied"/);
  assert.match(viewfinderServer,/failedCommandId/);
  assert.match(viewfinderServer,/if \(!dispatched\) return \{ applied:false,error:"renderer-unavailable"/);
});

test("phone transport starts from authoritative desktop state and bounds stalled requests", () => {
  const html = motionHtml("token");
  assert.match(html,/fetchWithTimeout/);
  assert.match(html,/AbortController/);
  assert.match(html,/telemetryInFlight/);
  assert.match(html,/async function initialize\(\)\{probeXR\(\);await pollLinkTelemetry\(\);if\(!alive\)return;sendLoop\(\)/);
  assert.doesNotMatch(html,/probeXR\(\);sendLoop\(\);pollLinkTelemetry\(\)/);
});

test("LIVE backchannel uses the effective physical preview focal instead of stale saved camera focal", () => {
  assert.match(viewfinderServer,/const live=physical\?\.livePreview/);
  assert.match(viewfinderServer,/focalMm:Number\(live\?\.focal \?\? appState\?\.camera\?\.focal \?\? 35\)/);
});

test("handheld compatibility patches are guaranteed after every Electron renderer reload", () => {
  const core = mainSource.indexOf('"phone-motion-core.js"');
  const focal = mainSource.indexOf('"phone-motion-core-absolute-focal.js"');
  const motion = mainSource.indexOf('"phone-motion-camera-ux.js"');
  const command = mainSource.indexOf('"phone-handheld-command-ux.js"');
  assert.ok(core >= 0 && focal > core && motion > focal && command > motion);
  assert.match(viewfinderServer,/performance\.timeOrigin/);
  assert.doesNotMatch(viewfinderServer,/patchedWebContentsId/);
});
'''
text = read(tests)
if 'REC STOP command queue keeps a newer STOP' in text:
    raise SystemExit('tests already patched')
write(tests, text + append)

print('phone handheld reliability patch applied')
