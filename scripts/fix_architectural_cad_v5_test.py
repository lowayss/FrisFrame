from pathlib import Path

path = Path("tests/architectural-cad-v5-runtime.test.cjs")
source = path.read_text(encoding="utf-8")
old = 'assert.ok(dimension.start.zM < -1.5 && dimension.end.zM < -1.5, "bottom wall CAD dimension should sit outside the room");\n'
new = 'assert.equal(api.selectRoomAtPoint(dimension.midpoint.xM, dimension.midpoint.zM), null, "wall CAD dimension midpoint must sit outside its room regardless of wall direction");\n'
if old not in source:
    raise SystemExit("missing v5 dimension assertion anchor")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
