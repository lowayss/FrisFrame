from pathlib import Path

live = Path('electron/camera-operator-live-ux.js')
text = live.read_text(encoding='utf-8')
old = '    let firstKey = exactKey || [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0];\n'
new = '    let firstKey = exactKey || (ensureStartKey ? null : [...cameraKeys].sort((left, right) => Number(left.time) - Number(right.time))[0]);\n'
if old not in text:
    raise SystemExit('camera operator start-key selection block not found')
live.write_text(text.replace(old, new, 1), encoding='utf-8')

test = Path('tests/camera-operator-live-contract.test.cjs')
text = test.read_text(encoding='utf-8')
anchor = 'assert.match(controller, /adoptStartPose/, "Physical Camera must rewrite the take start key to the adopted LIVE phone pose");\n'
addition = anchor + 'assert.match(controller, /exactKey \\|\\| \\(ensureStartKey \\? null : \\[\\.\\.\\.cameraKeys\\]/, "Physical Camera must start at the current playhead instead of jumping to an older camera key");\n'
if anchor not in text:
    raise SystemExit('Physical Camera keyframe contract anchor not found')
test.write_text(text.replace(anchor, addition, 1), encoding='utf-8')

print('Physical Camera current-playhead start behavior patched')
