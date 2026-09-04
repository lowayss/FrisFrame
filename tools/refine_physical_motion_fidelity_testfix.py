from pathlib import Path

# Correct the natural-hold numeric boundary: movement reaches the settled pose at 0.4s.
p = Path("tests/camera-operator-core.test.cjs")
s = p.read_text(encoding="utf-8")
old = '  assert.ok(times.includes(0.5), "the settle edge of a closing hold must survive");\n'
new = '  assert.ok(times.includes(0.4), "the first settled sample of a closing hold must survive");\n'
if old not in s:
    raise SystemExit("stale settle-edge test target")
p.write_text(s.replace(old, new, 1), encoding="utf-8")

# The reinforced recorder captures stabilized phone packets on their real arrival timing,
# so the old RAF-based 60/30 sampleInterval contract is intentionally obsolete.
p = Path("tests/physical-camera-take-context.test.cjs")
s = p.read_text(encoding="utf-8")
old = '''  assert.match(cameraOperatorUx, /sampleInterval = recordInput === "phone" \\? 1 \\/ 60 : 1 \\/ 30/,
    "Physical Camera must sample the live phone pose at display-class cadence");
'''
new = '''  assert.match(cameraOperatorUx, /const recordPhysicalPose = \\(pose\\) =>/,
    "Physical Camera must capture stabilized phone poses on packet arrival");
  assert.match(cameraOperatorUx, /time - lastSampleTime >= 1 \\/ 90/,
    "Physical Camera packet capture must retain display-class motion without duplicate bursts");
'''
if old not in s:
    raise SystemExit("stale Physical Camera sampling contract target")
p.write_text(s.replace(old, new, 1), encoding="utf-8")

print("Physical Camera fidelity test contracts corrected")
