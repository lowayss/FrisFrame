from pathlib import Path

p = Path("tests/camera-operator-core.test.cjs")
s = p.read_text(encoding="utf-8")
old = '  assert.ok(times.includes(0.5), "the settle edge of a closing hold must survive");\n'
new = '  assert.ok(times.includes(0.4), "the first settled sample of a closing hold must survive");\n'
if old not in s:
    raise SystemExit("stale settle-edge test target")
p.write_text(s.replace(old, new, 1), encoding="utf-8")
print("Physical Camera settle-edge test corrected")
