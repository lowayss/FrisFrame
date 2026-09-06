from pathlib import Path

path = Path("tests/architectural-cad-v5-runtime.test.cjs")
source = path.read_text(encoding="utf-8")
anchor = '''const dimension = api.getWallDimensionGeometry(bottom);\nassert.ok(dimension);\n'''
insert = '''const dimension = api.getWallDimensionGeometry(bottom);\nassert.ok(dimension);\nconsole.log("V5_DIM_DIAG", JSON.stringify({\n  room: api.roomZones[0],\n  bottom: stateObject.setMasterPlan.elements.find((entry) => entry.id === bottom),\n  dimension,\n  dimRoom: api.selectRoomAtPoint(dimension.midpoint.xM, dimension.midpoint.zM),\n}));\napi.selectRoom(null);\n'''
if anchor not in source:
    raise SystemExit("missing v5 diagnostic anchor")
path.write_text(source.replace(anchor, insert, 1), encoding="utf-8")
