from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")
old = '''  function applyWallGeometryOnly(item, element, line) {
    const centerX = (line.sx + line.ex) / 2, centerZ = (line.sz + line.ez) / 2;
    setWorld(item, centerX, centerZ);
'''
new = '''  function applyWallGeometryOnly(item, element, line) {
    const renderCenter = wallRenderCenter(element, line);
    setWorld(item, renderCenter.x, renderCenter.z);
'''
if old not in source:
    raise SystemExit("applyWallGeometryOnly alignment anchor not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
