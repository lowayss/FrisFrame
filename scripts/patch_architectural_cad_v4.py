from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise SystemExit(f"missing anchor: {label}")
    source = source.replace(old, new, 1)


replace_once(
'''  function refreshRoomZones() {
    const current = plan();
    if (!current) return [];
    current.roomZones = deriveRoomZones();
    return current.roomZones;
  }
''',
'''  function roomZoneKey(room) {
    return (room?.wallIds || []).map(String).sort().join("|");
  }
  function refreshRoomZones() {
    const current = plan();
    if (!current) return [];
    const previous = Array.isArray(current.roomZones) ? current.roomZones : [];
    if (!current.roomZoneMetadata || typeof current.roomZoneMetadata !== "object") current.roomZoneMetadata = {};
    const next = deriveRoomZones();
    next.forEach((room) => {
      const key = roomZoneKey(room);
      let metadata = current.roomZoneMetadata[key] || null;
      if (!metadata) {
        let best = null;
        previous.forEach((candidate) => {
          const candidateMeta = current.roomZoneMetadata[roomZoneKey(candidate)]
            || (candidate?.metadataBasis === "user_fixed" ? { name: candidate.name, use: candidate.use || "" } : null);
          if (!candidateMeta) return;
          const shared = (candidate.wallIds || []).filter((id) => (room.wallIds || []).map(String).includes(String(id))).length;
          if (!best || shared > best.shared) best = { candidate, metadata: candidateMeta, shared };
        });
        if (best && best.shared >= 2) {
          metadata = { name: String(best.metadata.name || room.name), use: String(best.metadata.use || "") };
          current.roomZoneMetadata[key] = metadata;
        }
      }
      if (metadata) {
        room.name = String(metadata.name || room.name);
        room.use = String(metadata.use || "");
        room.metadataBasis = "user_fixed";
      } else {
        room.use = "";
      }
    });
    current.roomZones = next;
    return current.roomZones;
  }
''',
"room metadata preservation",
)

replace_once(
'''  function updateWallItemFromLine(item, element, oldLine, nextLine) {
    const centerX = (nextLine.sx + nextLine.ex) / 2, centerZ = (nextLine.sz + nextLine.ez) / 2;
    setWorld(item, centerX, centerZ);
''',
'''  function wallInsideNormal(element, line) {
    const length = Math.max(1e-9, Number(line?.length || Math.hypot((line?.ex || 0) - (line?.sx || 0), (line?.ez || 0) - (line?.sz || 0))));
    const left = { x: -(line.ez - line.sz) / length, z: (line.ex - line.sx) / length };
    const room = (plan()?.roomZones || []).find((entry) => (entry.wallIds || []).map(String).includes(String(element?.id)));
    if (!room) return left;
    const center = { x: (line.sx + line.ex) / 2, z: (line.sz + line.ez) / 2 };
    const centroid = roomCentroid(room);
    const dot = (centroid.x - center.x) * left.x + (centroid.z - center.z) * left.z;
    return dot >= 0 ? left : { x: -left.x, z: -left.z };
  }
  function wallRenderOffset(element, line) {
    const alignment = String(element?.thicknessAlignment || "center");
    if (alignment === "center") return { x: 0, z: 0 };
    const normal = wallInsideNormal(element, line);
    const scalar = Number(line?.thickness || element?.depthM || 0.15) * 0.5 * (alignment === "outside" ? -1 : 1);
    return { x: normal.x * scalar, z: normal.z * scalar };
  }
  function wallRenderCenter(element, line) {
    const offset = wallRenderOffset(element, line);
    return { x: (line.sx + line.ex) / 2 + offset.x, z: (line.sz + line.ez) / 2 + offset.z };
  }
  function updateWallItemFromLine(item, element, oldLine, nextLine) {
    const renderCenter = wallRenderCenter(element, nextLine);
    setWorld(item, renderCenter.x, renderCenter.z);
''',
"wall render alignment helpers",
)

replace_once(
'''    const line = lineFor(parent, parentItem), world = worldOf(item), dims = dimensions(item);
    const point = project(world.x, world.z, line, Number(element.widthM || dims?.width || 0) / 2);
    if (!point) return false;
    setWorld(item, point.x, point.z);
    item.facing = ((line.rotation % 360) + 360) % 360;
    element.worldXM = point.x;
    element.worldZM = point.z;
''',
'''    const line = lineFor(parent, parentItem), world = worldOf(item), dims = dimensions(item);
    const point = project(world.x, world.z, line, Number(element.widthM || dims?.width || 0) / 2);
    if (!point) return false;
    const offset = wallRenderOffset(parent, line);
    const renderX = point.x + offset.x, renderZ = point.z + offset.z;
    setWorld(item, renderX, renderZ);
    item.facing = ((line.rotation % 360) + 360) % 360;
    element.worldXM = renderX;
    element.worldZM = renderZ;
''',
"opening follows wall-body offset",
)

replace_once(
'''      const x = nextLine.sx + (nextLine.ex - nextLine.sx) * t;
      const z = nextLine.sz + (nextLine.ez - nextLine.sz) * t;
      setWorld(item, x, z);
      item.facing = ((nextLine.rotation % 360) + 360) % 360;
      element.worldXM = x;
      element.worldZM = z;
''',
'''      const x = nextLine.sx + (nextLine.ex - nextLine.sx) * t;
      const z = nextLine.sz + (nextLine.ez - nextLine.sz) * t;
      const parentElement = elementFor(parentId);
      const offset = parentElement ? wallRenderOffset(parentElement, nextLine) : { x: 0, z: 0 };
      const renderX = x + offset.x, renderZ = z + offset.z;
      setWorld(item, renderX, renderZ);
      item.facing = ((nextLine.rotation % 360) + 360) % 360;
      element.worldXM = renderX;
      element.worldZM = renderZ;
''',
"child render offset",
)

replace_once(
'''    const center = worldOf(item), dims = dimensions(item);
    const length = Math.max(0.1, Number(element.widthM || dims?.width || oldLine.length));
''',
'''    const renderCenter = worldOf(item), dims = dimensions(item);
    const oldOffset = wallRenderOffset(element, oldLine);
    const center = { x: renderCenter.x - oldOffset.x, z: renderCenter.z - oldOffset.z };
    const length = Math.max(0.1, Number(element.widthM || dims?.width || oldLine.length));
''',
"reconcile baseline center",
)
replace_once(
'''    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    return true;
  }
  function polygonArea(points) {
''',
'''    applyWallGeometryOnly(item, element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    return true;
  }
  function polygonArea(points) {
''',
"reconcile aligned wall geometry",
)

old_set_metrics = '''  function setWallMetrics(itemId, lengthM, thicknessM) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    if (locked(item)) {
      if (typeof notifyEditLocked === "function") notifyEditLocked(item.name || "벽");
      return false;
    }
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const oldLine = lineFor(element, item);
    const length = clamp(lengthM ?? oldLine.length, 0.1, 100), thickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2);
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2, angle = oldLine.rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    const nextLine = { sx: cx - hx, sz: cz - hz, ex: cx + hx, ez: cz + hz, length, thickness, rotation: oldLine.rotation };
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = { width: length, height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)), depth: thickness };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    refreshRoomZones();
    const preserved = [item.id, ...children(item.id).map((entry) => entry.item.id)];
    if (typeof commit === "function") commit({ preserveSourceIds: preserved });
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    syncFields();
    return true;
  }
'''
new_set_metrics = '''  function setWallMetrics(itemId, lengthM, thicknessM, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    if (locked(item)) {
      if (typeof notifyEditLocked === "function") notifyEditLocked(item.name || "벽");
      return false;
    }
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const oldLine = lineFor(element, item);
    const length = clamp(lengthM ?? oldLine.length, 0.1, 100), thickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2);
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2, angle = oldLine.rotation * Math.PI / 180;
    const hx = Math.cos(angle) * length / 2, hz = Math.sin(angle) * length / 2;
    const nextLine = { sx: cx - hx, sz: cz - hz, ex: cx + hx, ez: cz + hz, length, thickness, rotation: oldLine.rotation };
    applyWallGeometryOnly(item, element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
    refreshRoomZones();
    if (options.commit !== false) commitCad([item.id, ...children(item.id).map((entry) => entry.item.id)]);
    else { syncFields(); syncMeasurementOverlay(); }
    return true;
  }
'''
replace_once(old_set_metrics, new_set_metrics, "wall metrics options")

replace_once(
'''      assetType: "wall",
      line: null,
''',
'''      assetType: "wall",
      thicknessAlignment: ["center", "inside", "outside"].includes(String(options.thicknessAlignment || "center")) ? String(options.thicknessAlignment || "center") : "center",
      line: null,
''',
"wall thickness alignment property",
)
replace_once(
'''    writeLine(element, { sx, sz, ex, ez, length, thickness, rotation });
    if (!registerCadEntity(item, element)) return false;
    refreshRoomZones();
''',
'''    writeLine(element, { sx, sz, ex, ez, length, thickness, rotation });
    if (!registerCadEntity(item, element)) return false;
    applyWallGeometryOnly(item, element, lineFor(element, item));
    refreshRoomZones();
''',
"position new wall by alignment",
)

replace_once(
'''    const point = project(Number(worldX), Number(worldZ), line, width / 2);
    if (!point) return false;
    const id = String(options.id || nextCadId(openingKind));
''',
'''    const point = project(Number(worldX), Number(worldZ), line, width / 2);
    if (!point) return false;
    const offset = wallRenderOffset(wall, line);
    const renderX = point.x + offset.x, renderZ = point.z + offset.z;
    const id = String(options.id || nextCadId(openingKind));
''',
"opening insertion wall-body offset",
)
replace_once(
'''      motionEnabled: false,
    };
    setWorld(item, point.x, point.z);
''',
'''      motionEnabled: false,
      ...(openingKind === "door" ? { doorSwing: { hinge: "left", direction: "in", angleDeg: 90 } } : {}),
    };
    setWorld(item, renderX, renderZ);
''',
"opening item swing and offset",
)
replace_once(
'''      worldXM: point.x,
      worldZM: point.z,
''',
'''      worldXM: renderX,
      worldZM: renderZ,
''',
"opening element render position",
)
replace_once(
'''      assetType: openingKind,
      line: null,
''',
'''      assetType: openingKind,
      ...(openingKind === "door" ? { doorSwing: { hinge: "left", direction: "in", angleDeg: 90 } } : {}),
      line: null,
''',
"opening element swing",
)

replace_once(
'''  function roomCentroid(room) {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (!points.length) return { x: 0, z: 0 };
    const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
    return { x: sum.x / points.length, z: sum.z / points.length };
  }
  function measurementSummary() {
''',
'''  function roomCentroid(room) {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (!points.length) return { x: 0, z: 0 };
    const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
    return { x: sum.x / points.length, z: sum.z / points.length };
  }
  function setRoomMetadata(roomId, values = {}, options = {}) {
    const current = plan(), room = (current?.roomZones || []).find((entry) => String(entry.id) === String(roomId));
    if (!current || !room) return false;
    if (!current.roomZoneMetadata || typeof current.roomZoneMetadata !== "object") current.roomZoneMetadata = {};
    const name = String(values.name ?? room.name ?? "Room").trim().slice(0, 80) || room.name || "Room";
    const use = String(values.use ?? room.use ?? "").trim().slice(0, 80);
    const metadata = { name, use };
    current.roomZoneMetadata[roomZoneKey(room)] = metadata;
    room.name = name;
    room.use = use;
    room.metadataBasis = "user_fixed";
    if (options.commit !== false) commitCad(room.wallIds || []);
    else syncMeasurementOverlay();
    return { ...metadata };
  }
  function setOpeningMetrics(itemId, values = {}, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isOpening(element, item) || locked(item)) return false;
    const parent = elementFor(element.parentId), parentItem = itemFor(element.parentId);
    if (!parent || !parentItem || !isWall(parent, parentItem)) return false;
    const line = lineFor(parent, parentItem), dims = dimensions(item) || {};
    const width = clamp(values.widthM ?? element.widthM ?? dims.width ?? 0.9, 0.2, 6);
    if (!line || width > line.length - 0.04) return false;
    const height = clamp(values.heightM ?? element.heightM ?? dims.height ?? 2.1, 0.2, 6);
    const depth = clamp(values.depthM ?? element.depthM ?? dims.depth ?? 0.12, 0.03, 1);
    const parentHeight = Math.max(height, Number(parent.heightM || dimensions(parentItem)?.height || 2.8));
    const mountedHeight = clamp(values.mountedHeightM ?? element.mountedHeightM ?? item.mountedHeight ?? 0, 0, Math.max(0, parentHeight - height));
    item.referenceDimensionsM = { width, height, depth };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    item.mountedHeight = mountedHeight;
    element.widthM = width;
    element.heightM = height;
    element.depthM = depth;
    element.mountedHeightM = mountedHeight;
    snapOpening(itemId);
    const result = { widthM: width, heightM: height, depthM: depth, mountedHeightM: mountedHeight };
    if (options.commit !== false) commitCad([element.parentId, itemId]);
    else { syncFields(); syncMeasurementOverlay(); }
    return result;
  }
  function setDoorSwing(itemId, hinge, direction, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || kindOf(element, item) !== "door" || locked(item)) return false;
    const nextHinge = String(hinge || element.doorSwing?.hinge || "left");
    const nextDirection = String(direction || element.doorSwing?.direction || "in");
    if (!["left", "right"].includes(nextHinge) || !["in", "out"].includes(nextDirection)) return false;
    const angleDeg = clamp(options.angleDeg ?? element.doorSwing?.angleDeg ?? 90, 15, 180);
    const swing = { hinge: nextHinge, direction: nextDirection, angleDeg };
    item.doorSwing = { ...swing };
    element.doorSwing = { ...swing };
    if (options.commit !== false) commitCad([element.parentId, itemId]);
    else syncMeasurementOverlay();
    return swing;
  }
  function setWallThicknessAlignment(itemId, alignment, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    const value = String(alignment || "center");
    if (!item || !element || !isWall(element, item) || locked(item) || !["center", "inside", "outside"].includes(value)) return false;
    const line = lineFor(element, item);
    element.thicknessAlignment = value;
    applyWallGeometryOnly(item, element, line);
    moveChildren(itemId, line, line);
    if (options.commit !== false) commitCad([itemId, ...children(itemId).map((entry) => entry.item.id)]);
    else { syncFields(); syncMeasurementOverlay(); }
    return value;
  }
  function setWallLengthFromMeasurement(itemId, lengthM, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    const line = lineFor(element, item);
    return setWallMetrics(itemId, lengthM, line.thickness, options);
  }
  function measurementSummary() {
''',
"v4 editing APIs",
)

old_summary = '''  function measurementSummary() {
    const walls = (plan()?.elements || []).filter((entry) => {
      const item = itemFor(entry.id);
      return item && isWall(entry, item);
    }).map((entry) => {
      const line = lineFor(entry, itemFor(entry.id));
      return {
        id: String(entry.id),
        lengthM: Number(line.length.toFixed(4)),
        midpoint: { xM: Number(((line.sx + line.ex) / 2).toFixed(4)), zM: Number(((line.sz + line.ez) / 2).toFixed(4)) },
      };
    });
    const rooms = (plan()?.roomZones || []).map((room) => {
      const points = Array.isArray(room.points) ? room.points : [];
      const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
      return {
        id: String(room.id),
        areaM2: Number(room.areaM2 || 0),
        centroid: { xM: points.length ? sum.x / points.length : 0, zM: points.length ? sum.z / points.length : 0 },
      };
    });
    return { walls, rooms };
  }
'''
new_summary = '''  function measurementSummary() {
    const walls = (plan()?.elements || []).filter((entry) => {
      const item = itemFor(entry.id);
      return item && isWall(entry, item);
    }).map((entry) => {
      const line = lineFor(entry, itemFor(entry.id));
      return {
        id: String(entry.id),
        lengthM: Number(line.length.toFixed(4)),
        thicknessM: Number(line.thickness.toFixed(4)),
        thicknessAlignment: String(entry.thicknessAlignment || "center"),
        midpoint: { xM: Number(((line.sx + line.ex) / 2).toFixed(4)), zM: Number(((line.sz + line.ez) / 2).toFixed(4)) },
      };
    });
    const rooms = (plan()?.roomZones || []).map((room) => {
      const points = Array.isArray(room.points) ? room.points : [];
      const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });
      return {
        id: String(room.id),
        name: String(room.name || ""),
        use: String(room.use || ""),
        areaM2: Number(room.areaM2 || 0),
        centroid: { xM: points.length ? sum.x / points.length : 0, zM: points.length ? sum.z / points.length : 0 },
      };
    });
    const openings = (plan()?.elements || []).filter((entry) => {
      const item = itemFor(entry.id);
      return item && isOpening(entry, item);
    }).map((entry) => {
      const item = itemFor(entry.id), dims = dimensions(item) || {};
      const world = worldOf(item);
      return {
        id: String(entry.id),
        kind: kindOf(entry, item),
        parentId: String(entry.parentId || ""),
        widthM: Number(entry.widthM || dims.width || 0),
        heightM: Number(entry.heightM || dims.height || 0),
        mountedHeightM: Number(entry.mountedHeightM ?? item.mountedHeight ?? 0),
        center: { xM: world.x, zM: world.z },
        doorSwing: entry.doorSwing ? { ...entry.doorSwing } : null,
      };
    });
    return { walls, rooms, openings };
  }
'''
replace_once(old_summary, new_summary, "measurement summary v4")

old_overlay = '''  function syncMeasurementOverlay() {
    const layer = measurementLayer();
    if (!layer) return;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.measurementsVisible;
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    if (!show) return;
    layer.textContent = "";
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    const summary = measurementSummary();
    const add = (text, x, z, kind) => {
      const screen = worldToCanvasPoint(x, z);
      if (!screen) return;
      const label = document.createElement("span");
      label.dataset.measurementKind = kind;
      label.textContent = text;
      label.style.cssText = "position:absolute;transform:translate(-50%,-50%);padding:2px 5px;border-radius:4px;background:rgba(10,18,22,.78);color:#e8fbff;font:11px/1.2 sans-serif;white-space:nowrap;pointer-events:none";
      label.style.left = `${screen.left}px`;
      label.style.top = `${screen.top}px`;
      layer.appendChild(label);
    };
    summary.walls.forEach((wall) => add(`${wall.lengthM.toFixed(2)} m`, wall.midpoint.xM, wall.midpoint.zM, "wall-length"));
    summary.rooms.forEach((room) => add(`${room.areaM2.toFixed(1)} ㎡`, room.centroid.xM, room.centroid.zM, "room-area"));
  }
'''
new_overlay = '''  function syncMeasurementOverlay() {
    const layer = measurementLayer();
    if (!layer) return;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.measurementsVisible;
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    if (!show) return;
    layer.textContent = "";
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    const summary = measurementSummary();
    const beginWallEdit = (label, wall) => {
      label.textContent = "";
      const input = document.createElement("input");
      input.type = "number"; input.min = "0.10"; input.max = "100"; input.step = "0.05"; input.value = wall.lengthM.toFixed(2);
      input.style.width = "58px";
      let cancelled = false;
      const finish = () => {
        if (cancelled) return syncMeasurementOverlay();
        const value = Number(input.value);
        if (Number.isFinite(value) && value >= 0.1) setWallLengthFromMeasurement(wall.id, value, { commit: true });
        else syncMeasurementOverlay();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { cancelled = true; syncMeasurementOverlay(); }
        if (event.key === "Enter") finish();
        event.stopPropagation?.();
      });
      input.addEventListener("blur", finish);
      label.appendChild(input);
      input.focus?.(); input.select?.();
    };
    const editRoom = (room) => {
      if (typeof root.prompt !== "function") return;
      const name = root.prompt("방 이름", room.name || "Room");
      if (name == null) return;
      const use = root.prompt("방 용도", room.use || "");
      if (use == null) return;
      setRoomMetadata(room.id, { name, use }, { commit: true });
    };
    const add = (text, x, z, kind, id, clickHandler = null) => {
      const screen = worldToCanvasPoint(x, z);
      if (!screen) return;
      const label = document.createElement("span");
      label.dataset.measurementKind = kind;
      label.dataset.measurementId = String(id || "");
      label.textContent = text;
      label.style.cssText = `position:absolute;transform:translate(-50%,-50%);padding:2px 5px;border-radius:4px;background:rgba(10,18,22,.78);color:#e8fbff;font:11px/1.2 sans-serif;white-space:nowrap;pointer-events:${clickHandler ? "auto" : "none"};cursor:${clickHandler ? "pointer" : "default"}`;
      label.style.left = `${screen.left}px`;
      label.style.top = `${screen.top}px`;
      if (clickHandler) label.addEventListener("click", (event) => { event.preventDefault?.(); event.stopPropagation?.(); clickHandler(label); });
      layer.appendChild(label);
    };
    summary.walls.forEach((wall) => add(`${wall.lengthM.toFixed(2)} m`, wall.midpoint.xM, wall.midpoint.zM, "wall-length", wall.id, (label) => beginWallEdit(label, wall)));
    summary.rooms.forEach((room) => add(`${room.name || "Room"} · ${room.areaM2.toFixed(1)} ㎡${room.use ? ` · ${room.use}` : ""}`, room.centroid.xM, room.centroid.zM, "room-area", room.id, () => editRoom(room)));
    summary.openings.forEach((opening) => {
      const swing = opening.kind === "door" && opening.doorSwing
        ? ` ${opening.doorSwing.hinge === "left" ? "↶" : "↷"} ${opening.doorSwing.direction.toUpperCase()}`
        : "";
      const text = opening.kind === "door"
        ? `문 ${opening.widthM.toFixed(2)}m${swing}`
        : `창 ${opening.widthM.toFixed(2)}×${opening.heightM.toFixed(2)}m`;
      add(text, opening.center.xM, opening.center.zM, "opening", opening.id);
    });
  }
'''
replace_once(old_overlay, new_overlay, "interactive measurement overlay")

old_install_fields = '''  function installFields() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls || document.getElementById("architecturalCadFields")) return Boolean(controls);
    const fields = document.createElement("span");
    fields.id = "architecturalCadFields";
    fields.hidden = true;
    fields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; badge.id = "architecturalRoomBadge";
    [[lengthInput, "벽 길이", "0.10", "100", "0.05"], [thicknessInput, "두께", "0.03", "2", "0.01"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label");
      wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "64px"; wrap.appendChild(input); fields.appendChild(wrap);
    });
    fields.appendChild(badge);
    const readout = document.getElementById("birdseyeCadReadout");
    controls.insertBefore(fields, readout || null);
    const apply = () => {
      const item = selectedItem();
      if (item) setWallMetrics(item.id, Number(lengthInput.value), Number(thicknessInput.value));
    };
    lengthInput.addEventListener("change", apply); thicknessInput.addEventListener("change", apply);
    return true;
  }
'''
new_install_fields = '''  function installFields() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls || document.getElementById("architecturalCadFields")) return Boolean(controls);
    const fields = document.createElement("span");
    fields.id = "architecturalCadFields";
    fields.hidden = true;
    fields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), alignmentInput = document.createElement("select"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; alignmentInput.id = "wallThicknessAlignment"; badge.id = "architecturalRoomBadge";
    [[lengthInput, "벽 길이", "0.10", "100", "0.05"], [thicknessInput, "두께", "0.03", "2", "0.01"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label");
      wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "64px"; wrap.appendChild(input); fields.appendChild(wrap);
    });
    [["center", "중심"], ["inside", "안쪽"], ["outside", "바깥쪽"]].forEach(([value, text]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = text; alignmentInput.appendChild(option);
    });
    const alignmentWrap = document.createElement("label"); alignmentWrap.textContent = "두께 기준"; alignmentWrap.appendChild(alignmentInput); fields.appendChild(alignmentWrap);
    fields.appendChild(badge);

    const openingFields = document.createElement("span");
    openingFields.id = "architecturalOpeningFields";
    openingFields.hidden = true;
    openingFields.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap";
    const openingWidth = document.createElement("input"), openingHeight = document.createElement("input"), openingMounted = document.createElement("input"), hinge = document.createElement("select"), direction = document.createElement("select");
    openingWidth.id = "openingWidthM"; openingHeight.id = "openingHeightM"; openingMounted.id = "openingMountedHeightM"; hinge.id = "doorSwingHinge"; direction.id = "doorSwingDirection";
    [[openingWidth, "폭", "0.20", "6", "0.05"], [openingHeight, "높이", "0.20", "6", "0.05"], [openingMounted, "설치높이", "0", "6", "0.05"]].forEach(([input, label, min, max, step]) => {
      const wrap = document.createElement("label"); wrap.textContent = label; input.type = "number"; input.min = min; input.max = max; input.step = step; input.style.width = "58px"; wrap.appendChild(input); openingFields.appendChild(wrap);
    });
    [["left", "좌힌지"], ["right", "우힌지"]].forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; hinge.appendChild(option); });
    [["in", "안으로"], ["out", "밖으로"]].forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; direction.appendChild(option); });
    const hingeWrap = document.createElement("label"); hingeWrap.id = "doorSwingHingeWrap"; hingeWrap.textContent = "힌지"; hingeWrap.appendChild(hinge); openingFields.appendChild(hingeWrap);
    const directionWrap = document.createElement("label"); directionWrap.id = "doorSwingDirectionWrap"; directionWrap.textContent = "열림"; directionWrap.appendChild(direction); openingFields.appendChild(directionWrap);

    const readout = document.getElementById("birdseyeCadReadout");
    controls.insertBefore(fields, readout || null);
    controls.insertBefore(openingFields, readout || null);
    const applyWall = () => { const item = selectedItem(); if (item) setWallMetrics(item.id, Number(lengthInput.value), Number(thicknessInput.value)); };
    const applyOpening = () => { const item = selectedItem(); if (item) setOpeningMetrics(item.id, { widthM: Number(openingWidth.value), heightM: Number(openingHeight.value), mountedHeightM: Number(openingMounted.value) }); };
    lengthInput.addEventListener("change", applyWall); thicknessInput.addEventListener("change", applyWall);
    alignmentInput.addEventListener("change", () => { const item = selectedItem(); if (item) setWallThicknessAlignment(item.id, alignmentInput.value); });
    openingWidth.addEventListener("change", applyOpening); openingHeight.addEventListener("change", applyOpening); openingMounted.addEventListener("change", applyOpening);
    const applySwing = () => { const item = selectedItem(); if (item) setDoorSwing(item.id, hinge.value, direction.value); };
    hinge.addEventListener("change", applySwing); direction.addEventListener("change", applySwing);
    return true;
  }
'''
replace_once(old_install_fields, new_install_fields, "selected wall/opening fields")

old_sync_fields = '''  function syncFields() {
    const fields = document.getElementById("architecturalCadFields");
    if (!fields) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && item && element && isWall(element, item);
    fields.hidden = !show;
    fields.style.display = show ? "inline-flex" : "none";
    if (!show) return;
    const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM");
    if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
    if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
    const badge = document.getElementById("architecturalRoomBadge");
    if (badge) badge.textContent = `방 ${plan()?.roomZones?.length || 0}`;
  }
'''
new_sync_fields = '''  function syncFields() {
    const fields = document.getElementById("architecturalCadFields"), openingFields = document.getElementById("architecturalOpeningFields");
    if (!fields) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const active25d = root.FrisFrameBirdseye25D?.mode === "2.5d";
    const showWall = active25d && item && element && isWall(element, item);
    const showOpening = active25d && item && element && isOpening(element, item);
    fields.hidden = !showWall; fields.style.display = showWall ? "inline-flex" : "none";
    if (openingFields) { openingFields.hidden = !showOpening; openingFields.style.display = showOpening ? "inline-flex" : "none"; }
    if (showWall) {
      const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM"), alignmentInput = document.getElementById("wallThicknessAlignment");
      if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
      if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
      if (alignmentInput) alignmentInput.value = String(element.thicknessAlignment || "center");
      const badge = document.getElementById("architecturalRoomBadge");
      if (badge) badge.textContent = `방 ${plan()?.roomZones?.length || 0}`;
    }
    if (showOpening && openingFields) {
      const dims = dimensions(item) || {};
      const widthInput = document.getElementById("openingWidthM"), heightInput = document.getElementById("openingHeightM"), mountedInput = document.getElementById("openingMountedHeightM");
      if (document.activeElement !== widthInput) widthInput.value = Number(element.widthM || dims.width || 0).toFixed(2);
      if (document.activeElement !== heightInput) heightInput.value = Number(element.heightM || dims.height || 0).toFixed(2);
      if (document.activeElement !== mountedInput) mountedInput.value = Number(element.mountedHeightM ?? item.mountedHeight ?? 0).toFixed(2);
      const isDoor = kindOf(element, item) === "door", hingeWrap = document.getElementById("doorSwingHingeWrap"), directionWrap = document.getElementById("doorSwingDirectionWrap");
      if (hingeWrap) hingeWrap.style.display = isDoor ? "inline" : "none";
      if (directionWrap) directionWrap.style.display = isDoor ? "inline" : "none";
      if (isDoor) {
        const swing = element.doorSwing || { hinge: "left", direction: "in" };
        const hinge = document.getElementById("doorSwingHinge"), direction = document.getElementById("doorSwingDirection");
        if (hinge) hinge.value = swing.hinge;
        if (direction) direction.value = swing.direction;
      }
    }
  }
'''
replace_once(old_sync_fields, new_sync_fields, "sync opening fields")

replace_once(
'''      insertOpening,
      getMeasurementSummary: measurementSummary,
      setMeasurementsVisible,
''',
'''      insertOpening,
      setRoomMetadata,
      setOpeningMetrics,
      setDoorSwing,
      setWallThicknessAlignment,
      setWallLengthFromMeasurement,
      getMeasurementSummary: measurementSummary,
      setMeasurementsVisible,
''',
"public v4 API",
)

path.write_text(source, encoding="utf-8")

quality = Path("quality_check.py")
q = quality.read_text(encoding="utf-8")
needle = '        "tests/architectural-cad-v3-runtime.test.cjs",\n'
if needle not in q:
    raise SystemExit("quality gate anchor not found")
q = q.replace(needle, needle + '        "tests/architectural-cad-v4-runtime.test.cjs",\n', 1)
quality.write_text(q, encoding="utf-8")
