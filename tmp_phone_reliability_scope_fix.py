from pathlib import Path
p=Path('electron/phone-director-viewfinder.cjs')
s=p.read_text(encoding='utf-8')
anchor='''function sanitizeMotionInput(payload = {}) {'''
helper='''function commandTransitionSatisfied(command, before = {}, after = {}) {\n  const beforeMode = String(before.mode || "idle");\n  const afterMode = String(after.mode || "idle");\n  if (command === "toggle-record") return beforeMode === "recording" ? afterMode !== "recording" : afterMode === "recording";\n  if (command === "stop" || command === "cancel") return afterMode === "idle";\n  return true;\n}\n\n'''
if helper in s:
    raise SystemExit('top-level helper already exists')
if anchor not in s:
    raise SystemExit('sanitize anchor missing')
s=s.replace(anchor,helper+anchor,1)
inner='''  function commandTransitionSatisfied(command, before = {}, after = {}) {\n    const beforeMode = String(before.mode || "idle");\n    const afterMode = String(after.mode || "idle");\n    if (command === "toggle-record") return beforeMode === "recording" ? afterMode !== "recording" : afterMode === "recording";\n    if (command === "stop" || command === "cancel") return afterMode === "idle";\n    return true;\n  }\n\n'''
if s.count(inner)!=1:
    raise SystemExit(f'expected inner helper once, got {s.count(inner)}')
s=s.replace(inner,'',1)
p.write_text(s,encoding='utf-8')
print('scope fixed')
