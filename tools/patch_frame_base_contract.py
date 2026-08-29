from pathlib import Path

path = Path("tests/dom-contract.test.cjs")
text = path.read_text(encoding="utf-8")
old = 'assert.ok(app.includes("applyActiveCameraTracking(next, state)"), "active camera tracking must be restored after state interpolation");\n'
new = (
    'assert.ok(app.includes("applyActiveCameraTracking(next, renderState)"), "active camera tracking must be restored after shared render-state interpolation");\n'
    'assert.match(app, /function interpolateStateAtTime\\(time\\) \\{\\s*return interpolateRenderStateAtTime\\(state, time\\);\\s*\\}/, "state interpolation must enter the shared render-state evaluator before tracking");\n'
)
if text.count(old) != 1:
    raise SystemExit(f"expected one tracking contract, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("frame base tracking contract migrated")
