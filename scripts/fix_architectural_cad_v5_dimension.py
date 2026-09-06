from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")
old = '''    const line = lineFor(element, item);
    const inside = wallInsideNormal(element, line);
    const outward = { x: -inside.x, z: -inside.z };
    const offset = Number.isFinite(Number(offsetM)) ? Number(offsetM) : Math.max(0.28, line.thickness * 0.5 + 0.22);
'''
new = '''    const line = lineFor(element, item);
    const inside = wallInsideNormal(element, line);
    let outward = { x: -inside.x, z: -inside.z };
    const room = (plan()?.roomZones || []).find((entry) => (entry.wallIds || []).map(String).includes(String(itemId)));
    if (room) {
      const midpoint = { x: (line.sx + line.ex) / 2, z: (line.sz + line.ez) / 2 };
      const left = { x: -(line.ez - line.sz) / line.length, z: (line.ex - line.sx) / line.length };
      const probe = Math.max(0.05, Math.min(0.2, line.length * 0.05));
      const plusInside = pointInRoom(room, midpoint.x + left.x * probe, midpoint.z + left.z * probe);
      const minusInside = pointInRoom(room, midpoint.x - left.x * probe, midpoint.z - left.z * probe);
      if (plusInside !== minusInside) outward = plusInside ? { x: -left.x, z: -left.z } : left;
      else {
        const centroid = roomCentroid(room);
        const dot = (centroid.x - midpoint.x) * left.x + (centroid.z - midpoint.z) * left.z;
        outward = dot >= 0 ? { x: -left.x, z: -left.z } : left;
      }
    }
    const explicitOffset = offsetM != null && Number.isFinite(Number(offsetM));
    const offset = explicitOffset ? Number(offsetM) : Math.max(0.28, line.thickness * 0.5 + 0.22);
'''
if old not in source:
    raise SystemExit("missing wallDimensionGeometry side anchor")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
