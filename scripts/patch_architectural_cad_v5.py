from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise SystemExit(f"missing anchor: {label}")
    source = source.replace(old, new, 1)


replace_once(
'''  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null, tool: "select", toolAnchor: null, mergeFirstWallId: null, measurementsVisible: true };\n''',
'''  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null, tool: "select", toolAnchor: null, mergeFirstWallId: null, measurementsVisible: true, selectedRoomId: null };\n''',
"runtime selected room",
)

replace_once(
'''  function setWallEndpoint(itemId, endpoint, worldX, worldZ, options = {}) {\n''',
'''  function normalizedWallConstraint(element, line = null) {
    const raw = element?.constraints || {};
    const axis = ["free", "horizontal", "vertical"].includes(String(raw.axis || "free")) ? String(raw.axis || "free") : "free";
    const lengthLocked = Boolean(raw.lengthLocked);
    const fallbackLength = Number(line?.length || element?.widthM || 0);
    const lengthM = lengthLocked ? Math.max(0.1, Number(raw.lengthM || fallbackLength || 0.1)) : null;
    return { axis, lengthLocked, lengthM };
  }
  function constrainWallEndpoint(element, endpoint, x, z, oldLine) {
    const constraint = normalizedWallConstraint(element, oldLine);
    const opposite = endpoint === "start"
      ? { x: oldLine.ex, z: oldLine.ez }
      : { x: oldLine.sx, z: oldLine.sz };
    let nextX = Number(x), nextZ = Number(z);
    if (constraint.axis === "horizontal") nextZ = opposite.z;
    if (constraint.axis === "vertical") nextX = opposite.x;
    if (constraint.lengthLocked && Number.isFinite(constraint.lengthM)) {
      const targetLength = constraint.lengthM;
      if (constraint.axis === "horizontal") {
        const oldSign = endpoint === "start" ? Math.sign(oldLine.sx - oldLine.ex) : Math.sign(oldLine.ex - oldLine.sx);
        const candidateSign = Math.sign(nextX - opposite.x) || oldSign || 1;
        nextX = opposite.x + candidateSign * targetLength;
        nextZ = opposite.z;
      } else if (constraint.axis === "vertical") {
        const oldSign = endpoint === "start" ? Math.sign(oldLine.sz - oldLine.ez) : Math.sign(oldLine.ez - oldLine.sz);
        const candidateSign = Math.sign(nextZ - opposite.z) || oldSign || 1;
        nextX = opposite.x;
        nextZ = opposite.z + candidateSign * targetLength;
      } else {
        let dx = nextX - opposite.x, dz = nextZ - opposite.z;
        let length = Math.hypot(dx, dz);
        if (length < 1e-7) {
          dx = endpoint === "start" ? oldLine.sx - oldLine.ex : oldLine.ex - oldLine.sx;
          dz = endpoint === "start" ? oldLine.sz - oldLine.ez : oldLine.ez - oldLine.sz;
          length = Math.max(1e-7, Math.hypot(dx, dz));
        }
        nextX = opposite.x + dx / length * targetLength;
        nextZ = opposite.z + dz / length * targetLength;
      }
    }
    return { x: nextX, z: nextZ, constraint };
  }
  function setWallEndpoint(itemId, endpoint, worldX, worldZ, options = {}) {\n''',
"wall constraint helpers",
)

replace_once(
'''    if (options.snap !== false) {
      const target = nearestWallEndpoint(x, z, itemId, Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M));
      if (target) {
        x = target.x; z = target.z; runtime.lastEndpointSnap = target;
      }
    }
    const sx = endpoint === "start" ? x : oldLine.sx;
''',
'''    if (options.snap !== false) {
      const target = nearestWallEndpoint(x, z, itemId, Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M));
      if (target) {
        x = target.x; z = target.z; runtime.lastEndpointSnap = target;
      }
    }
    const constrained = constrainWallEndpoint(element, endpoint, x, z, oldLine);
    x = constrained.x; z = constrained.z;
    if (runtime.lastEndpointSnap && Math.hypot(x - runtime.lastEndpointSnap.x, z - runtime.lastEndpointSnap.z) > 1e-4) runtime.lastEndpointSnap = null;
    const sx = endpoint === "start" ? x : oldLine.sx;
''',
"endpoint applies constraints",
)

replace_once(
'''    const length = clamp(lengthM ?? oldLine.length, 0.1, 100), thickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2);
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2, angle = oldLine.rotation * Math.PI / 180;
''',
'''    const length = clamp(lengthM ?? oldLine.length, 0.1, 100), thickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2);
    if (element.constraints?.lengthLocked && Number.isFinite(Number(lengthM))) element.constraints.lengthM = length;
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2, angle = oldLine.rotation * Math.PI / 180;
''',
"locked length metric update",
)

replace_once(
'''      thicknessAlignment: ["center", "inside", "outside"].includes(String(options.thicknessAlignment || "center")) ? String(options.thicknessAlignment || "center") : "center",
      line: null,
''',
'''      thicknessAlignment: ["center", "inside", "outside"].includes(String(options.thicknessAlignment || "center")) ? String(options.thicknessAlignment || "center") : "center",
      constraints: {
        axis: ["free", "horizontal", "vertical"].includes(String(options.constraints?.axis || "free")) ? String(options.constraints?.axis || "free") : "free",
        lengthLocked: Boolean(options.constraints?.lengthLocked),
        lengthM: options.constraints?.lengthLocked ? length : null,
      },
      line: null,
''',
"new wall constraint state",
)

replace_once(
'''  function setWallLengthFromMeasurement(itemId, lengthM, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    const line = lineFor(element, item);
    return setWallMetrics(itemId, lengthM, line.thickness, options);
  }
  function measurementSummary() {
''',
'''  function setWallLengthFromMeasurement(itemId, lengthM, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return false;
    const line = lineFor(element, item);
    return setWallMetrics(itemId, lengthM, line.thickness, options);
  }
  function setWallConstraint(itemId, values = {}, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item) || locked(item)) return false;
    const oldLine = lineFor(element, item);
    const previous = normalizedWallConstraint(element, oldLine);
    const axis = values.axis == null ? previous.axis : String(values.axis);
    if (!["free", "horizontal", "vertical"].includes(axis)) return false;
    const lengthLocked = values.lengthLocked == null ? previous.lengthLocked : Boolean(values.lengthLocked);
    const requestedLength = values.lengthM == null ? (previous.lengthM || oldLine.length) : Number(values.lengthM);
    if (lengthLocked && (!Number.isFinite(requestedLength) || requestedLength < 0.1 || requestedLength > 100)) return false;
    const targetLength = lengthLocked ? requestedLength : oldLine.length;
    const cx = (oldLine.sx + oldLine.ex) / 2, cz = (oldLine.sz + oldLine.ez) / 2;
    let rotation = oldLine.rotation;
    if (axis === "horizontal") rotation = 0;
    if (axis === "vertical") rotation = 90;
    const angle = rotation * Math.PI / 180;
    const hx = Math.cos(angle) * targetLength / 2, hz = Math.sin(angle) * targetLength / 2;
    const nextLine = { sx: cx - hx, sz: cz - hz, ex: cx + hx, ez: cz + hz, length: targetLength, thickness: oldLine.thickness, rotation };
    element.constraints = { axis, lengthLocked, lengthM: lengthLocked ? targetLength : null };
    applyWallGeometryOnly(item, element, nextLine);
    moveChildren(itemId, oldLine, nextLine);
    refreshRoomZones();
    const result = { ...element.constraints };
    if (options.commit !== false) commitCad([itemId, ...children(itemId).map((entry) => entry.item.id)]);
    else { syncFields(); syncMeasurementOverlay(); }
    return result;
  }
  function pointInRoom(room, x, z) {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = Number(points[i].xM), zi = Number(points[i].zM), xj = Number(points[j].xM), zj = Number(points[j].zM);
      const crosses = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-12) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  }
  function selectRoom(roomId) {
    const id = roomId == null ? null : String(roomId);
    if (id && !(plan()?.roomZones || []).some((room) => String(room.id) === id)) return false;
    runtime.selectedRoomId = id;
    syncDraftingOverlay();
    syncMeasurementOverlay();
    return id;
  }
  function selectRoomAtPoint(x, z) {
    const candidates = (plan()?.roomZones || []).filter((room) => pointInRoom(room, Number(x), Number(z))).sort((a, b) => Number(a.areaM2 || 0) - Number(b.areaM2 || 0));
    if (!candidates.length) { selectRoom(null); return null; }
    selectRoom(candidates[0].id);
    return String(candidates[0].id);
  }
  function wallDimensionGeometry(itemId, offsetM = null) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item)) return null;
    const line = lineFor(element, item);
    const inside = wallInsideNormal(element, line);
    const outward = { x: -inside.x, z: -inside.z };
    const offset = Number.isFinite(Number(offsetM)) ? Number(offsetM) : Math.max(0.28, line.thickness * 0.5 + 0.22);
    const start = { xM: line.sx + outward.x * offset, zM: line.sz + outward.z * offset };
    const end = { xM: line.ex + outward.x * offset, zM: line.ez + outward.z * offset };
    return {
      wallId: String(itemId),
      lengthM: line.length,
      offsetM: offset,
      start,
      end,
      midpoint: { xM: (start.xM + end.xM) / 2, zM: (start.zM + end.zM) / 2 },
      extensionStart: { from: { xM: line.sx, zM: line.sz }, to: start },
      extensionEnd: { from: { xM: line.ex, zM: line.ez }, to: end },
    };
  }
  function doorSwingGeometry(itemId) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || kindOf(element, item) !== "door" || !element.parentId) return null;
    const parent = elementFor(element.parentId), parentItem = itemFor(element.parentId);
    if (!parent || !parentItem || !isWall(parent, parentItem)) return null;
    const line = lineFor(parent, parentItem), swing = element.doorSwing || item.doorSwing || { hinge: "left", direction: "in", angleDeg: 90 };
    const width = Math.max(0.2, Number(element.widthM || dimensions(item)?.width || 0.9));
    const dx = (line.ex - line.sx) / line.length, dz = (line.ez - line.sz) / line.length;
    const t = clamp(Number.isFinite(element.attachmentT) ? element.attachmentT : 0.5, width / 2 / line.length, 1 - width / 2 / line.length);
    const baseline = { x: line.sx + (line.ex - line.sx) * t, z: line.sz + (line.ez - line.sz) * t };
    const offset = wallRenderOffset(parent, line);
    const center = { x: baseline.x + offset.x, z: baseline.z + offset.z };
    const hingeLeft = String(swing.hinge || "left") === "left";
    const hinge = { xM: center.x + (hingeLeft ? -1 : 1) * dx * width / 2, zM: center.z + (hingeLeft ? -1 : 1) * dz * width / 2 };
    const closedUnit = { x: hingeLeft ? dx : -dx, z: hingeLeft ? dz : -dz };
    let normal = wallInsideNormal(parent, line);
    if (String(swing.direction || "in") === "out") normal = { x: -normal.x, z: -normal.z };
    const angleDeg = clamp(swing.angleDeg ?? 90, 15, 180), angle = angleDeg * Math.PI / 180;
    const pointAt = (theta) => ({ xM: hinge.xM + (closedUnit.x * Math.cos(theta) + normal.x * Math.sin(theta)) * width, zM: hinge.zM + (closedUnit.z * Math.cos(theta) + normal.z * Math.sin(theta)) * width });
    const arc = [];
    const segments = Math.max(6, Math.ceil(angleDeg / 10));
    for (let i = 0; i <= segments; i += 1) arc.push(pointAt(angle * i / segments));
    return {
      doorId: String(itemId),
      parentId: String(element.parentId),
      hinge: { ...hinge },
      closedEnd: pointAt(0),
      openEnd: pointAt(angle),
      arc,
      widthM: width,
      hingeSide: hingeLeft ? "left" : "right",
      direction: String(swing.direction || "in"),
      angleDeg,
    };
  }
  function measurementSummary() {
''',
"drafting and constraint APIs",
)

replace_once(
'''        thicknessAlignment: String(entry.thicknessAlignment || "center"),
        midpoint: { xM: Number(((line.sx + line.ex) / 2).toFixed(4)), zM: Number(((line.sz + line.ez) / 2).toFixed(4)) },
''',
'''        thicknessAlignment: String(entry.thicknessAlignment || "center"),
        constraint: normalizedWallConstraint(entry, line),
        midpoint: { xM: Number(((line.sx + line.ex) / 2).toFixed(4)), zM: Number(((line.sz + line.ez) / 2).toFixed(4)) },
        dimensionLine: wallDimensionGeometry(entry.id),
''',
"measurement wall drafting data",
)

replace_once(
'''        areaM2: Number(room.areaM2 || 0),
        centroid: { xM: points.length ? sum.x / points.length : 0, zM: points.length ? sum.z / points.length : 0 },
''',
'''        areaM2: Number(room.areaM2 || 0),
        selected: String(room.id) === String(runtime.selectedRoomId || ""),
        points: points.map((point) => ({ xM: Number(point.xM || 0), zM: Number(point.zM || 0) })),
        centroid: { xM: points.length ? sum.x / points.length : 0, zM: points.length ? sum.z / points.length : 0 },
''',
"measurement room selection data",
)

replace_once(
'''        doorSwing: entry.doorSwing ? { ...entry.doorSwing } : null,
''',
'''        doorSwing: entry.doorSwing ? { ...entry.doorSwing } : null,
        swingGeometry: kindOf(entry, item) === "door" ? doorSwingGeometry(entry.id) : null,
''',
"measurement door swing geometry",
)

replace_once(
'''  function measurementLayer() { return document.getElementById("architecturalCadMeasurements"); }
  function syncMeasurementOverlay() {
''',
'''  function measurementLayer() { return document.getElementById("architecturalCadMeasurements"); }
  function draftingLayer() { return document.getElementById("architecturalCadDrafting"); }
  function svgNode(tag) {
    return typeof document.createElementNS === "function" ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  }
  function setSvgAttrs(node, values) {
    Object.entries(values || {}).forEach(([key, value]) => node.setAttribute?.(key, String(value)));
  }
  function screenPath(points) {
    const result = [];
    for (const point of points || []) {
      const screen = worldToCanvasPoint(point.xM, point.zM);
      if (!screen) return null;
      result.push(screen);
    }
    return result;
  }
  function syncDraftingOverlay() {
    const layer = draftingLayer();
    if (!layer) return;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.measurementsVisible;
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!show) return;
    const summary = measurementSummary();
    summary.rooms.forEach((room) => {
      const screens = screenPath(room.points);
      if (!screens?.length) return;
      const polygon = svgNode("polygon");
      setSvgAttrs(polygon, {
        points: screens.map((point) => `${point.left},${point.top}`).join(" "),
        fill: room.selected ? "rgba(90,200,255,.22)" : "rgba(90,200,255,.07)",
        stroke: room.selected ? "rgba(165,235,255,.95)" : "rgba(90,200,255,.28)",
        "stroke-width": room.selected ? 2 : 1,
      });
      polygon.style.pointerEvents = "auto";
      polygon.style.cursor = "pointer";
      polygon.dataset.roomId = room.id;
      polygon.addEventListener?.("click", (event) => { event.preventDefault?.(); event.stopPropagation?.(); selectRoom(room.id); });
      layer.appendChild(polygon);
    });
    const addLine = (from, to, attrs = {}) => {
      const a = worldToCanvasPoint(from.xM, from.zM), b = worldToCanvasPoint(to.xM, to.zM);
      if (!a || !b) return;
      const line = svgNode("line");
      setSvgAttrs(line, { x1: a.left, y1: a.top, x2: b.left, y2: b.top, ...attrs });
      layer.appendChild(line);
    };
    summary.walls.forEach((wall) => {
      const dim = wall.dimensionLine;
      if (!dim) return;
      addLine(dim.extensionStart.from, dim.extensionStart.to, { stroke: "rgba(210,245,255,.55)", "stroke-width": 1 });
      addLine(dim.extensionEnd.from, dim.extensionEnd.to, { stroke: "rgba(210,245,255,.55)", "stroke-width": 1 });
      addLine(dim.start, dim.end, { stroke: "rgba(225,250,255,.88)", "stroke-width": 1.3 });
    });
    summary.openings.filter((opening) => opening.kind === "door" && opening.swingGeometry).forEach((opening) => {
      const swing = opening.swingGeometry;
      addLine(swing.hinge, swing.closedEnd, { stroke: "rgba(255,255,255,.38)", "stroke-width": 1, "stroke-dasharray": "4 3" });
      addLine(swing.hinge, swing.openEnd, { stroke: "rgba(255,235,160,.95)", "stroke-width": 2 });
      const screens = screenPath(swing.arc);
      if (!screens?.length) return;
      const polyline = svgNode("polyline");
      setSvgAttrs(polyline, { points: screens.map((point) => `${point.left},${point.top}`).join(" "), fill: "none", stroke: "rgba(255,235,160,.72)", "stroke-width": 1.2 });
      layer.appendChild(polyline);
    });
  }
  function syncMeasurementOverlay() {
''',
"drafting svg overlay",
)

replace_once(
'''    summary.walls.forEach((wall) => add(`${wall.lengthM.toFixed(2)} m`, wall.midpoint.xM, wall.midpoint.zM, "wall-length", wall.id, (label) => beginWallEdit(label, wall)));
''',
'''    summary.walls.forEach((wall) => {
      const point = wall.dimensionLine?.midpoint || wall.midpoint;
      const lock = wall.constraint?.lengthLocked ? " 🔒" : "";
      const axis = wall.constraint?.axis === "horizontal" ? " H" : wall.constraint?.axis === "vertical" ? " V" : "";
      add(`${wall.lengthM.toFixed(2)} m${axis}${lock}`, point.xM, point.zM, "wall-length", wall.id, (label) => beginWallEdit(label, wall));
    });
''',
"dimension label uses cad line",
)

replace_once(
'''    summary.openings.forEach((opening) => {
      const swing = opening.kind === "door" && opening.doorSwing
        ? ` ${opening.doorSwing.hinge === "left" ? "↶" : "↷"} ${opening.doorSwing.direction.toUpperCase()}`
        : "";
      const text = opening.kind === "door"
        ? `문 ${opening.widthM.toFixed(2)}m${swing}`
        : `창 ${opening.widthM.toFixed(2)}×${opening.heightM.toFixed(2)}m`;
      add(text, opening.center.xM, opening.center.zM, "opening", opening.id);
    });
  }
''',
'''    summary.openings.forEach((opening) => {
      const swing = opening.kind === "door" && opening.doorSwing
        ? ` ${opening.doorSwing.hinge === "left" ? "↶" : "↷"} ${opening.doorSwing.direction.toUpperCase()}`
        : "";
      const text = opening.kind === "door"
        ? `문 ${opening.widthM.toFixed(2)}m${swing}`
        : `창 ${opening.widthM.toFixed(2)}×${opening.heightM.toFixed(2)}m`;
      add(text, opening.center.xM, opening.center.zM, "opening", opening.id);
    });
    syncDraftingOverlay();
  }
''',
"measurement sync drafting",
)

replace_once(
'''    if (!measurementLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadMeasurements";
      layer.style.cssText = "position:absolute;inset:0;z-index:53;pointer-events:none";
      wrap.appendChild(layer);
    }
''',
'''    if (!draftingLayer()) {
      const layer = svgNode("svg");
      layer.id = "architecturalCadDrafting";
      layer.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:52;pointer-events:none;overflow:visible";
      wrap.appendChild(layer);
    }
    if (!measurementLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadMeasurements";
      layer.style.cssText = "position:absolute;inset:0;z-index:53;pointer-events:none";
      wrap.appendChild(layer);
    }
''',
"install drafting layer",
)

replace_once(
'''    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), alignmentInput = document.createElement("select"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; alignmentInput.id = "wallThicknessAlignment"; badge.id = "architecturalRoomBadge";
''',
'''    const lengthInput = document.createElement("input"), thicknessInput = document.createElement("input"), alignmentInput = document.createElement("select"), axisInput = document.createElement("select"), lengthLock = document.createElement("input"), badge = document.createElement("span");
    lengthInput.id = "wallLengthM"; thicknessInput.id = "wallThicknessM"; alignmentInput.id = "wallThicknessAlignment"; axisInput.id = "wallAxisConstraint"; lengthLock.id = "wallLengthLocked"; badge.id = "architecturalRoomBadge";
''',
"constraint controls vars",
)

replace_once(
'''    const alignmentWrap = document.createElement("label"); alignmentWrap.textContent = "두께 기준"; alignmentWrap.appendChild(alignmentInput); fields.appendChild(alignmentWrap);
    fields.appendChild(badge);
''',
'''    const alignmentWrap = document.createElement("label"); alignmentWrap.textContent = "두께 기준"; alignmentWrap.appendChild(alignmentInput); fields.appendChild(alignmentWrap);
    [["free", "자유"], ["horizontal", "수평"], ["vertical", "수직"]].forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; axisInput.appendChild(option); });
    const axisWrap = document.createElement("label"); axisWrap.textContent = "축"; axisWrap.appendChild(axisInput); fields.appendChild(axisWrap);
    lengthLock.type = "checkbox";
    const lockWrap = document.createElement("label"); lockWrap.textContent = "길이 고정"; lockWrap.appendChild(lengthLock); fields.appendChild(lockWrap);
    fields.appendChild(badge);
''',
"constraint controls ui",
)

replace_once(
'''    alignmentInput.addEventListener("change", () => { const item = selectedItem(); if (item) setWallThicknessAlignment(item.id, alignmentInput.value); });
    openingWidth.addEventListener("change", applyOpening); openingHeight.addEventListener("change", applyOpening); openingMounted.addEventListener("change", applyOpening);
''',
'''    alignmentInput.addEventListener("change", () => { const item = selectedItem(); if (item) setWallThicknessAlignment(item.id, alignmentInput.value); });
    axisInput.addEventListener("change", () => { const item = selectedItem(); if (item) setWallConstraint(item.id, { axis: axisInput.value }); });
    lengthLock.addEventListener("change", () => { const item = selectedItem(); if (item) setWallConstraint(item.id, { lengthLocked: Boolean(lengthLock.checked) }); });
    openingWidth.addEventListener("change", applyOpening); openingHeight.addEventListener("change", applyOpening); openingMounted.addEventListener("change", applyOpening);
''',
"constraint control listeners",
)

replace_once(
'''      const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM"), alignmentInput = document.getElementById("wallThicknessAlignment");
      if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
      if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
      if (alignmentInput) alignmentInput.value = String(element.thicknessAlignment || "center");
''',
'''      const line = lineFor(element, item), lengthInput = document.getElementById("wallLengthM"), thicknessInput = document.getElementById("wallThicknessM"), alignmentInput = document.getElementById("wallThicknessAlignment"), axisInput = document.getElementById("wallAxisConstraint"), lengthLock = document.getElementById("wallLengthLocked");
      if (document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
      if (document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
      if (alignmentInput) alignmentInput.value = String(element.thicknessAlignment || "center");
      const constraint = normalizedWallConstraint(element, line);
      if (axisInput) axisInput.value = constraint.axis;
      if (lengthLock) lengthLock.checked = constraint.lengthLocked;
''',
"sync constraint controls",
)

replace_once(
'''      setWallThicknessAlignment,
      setWallLengthFromMeasurement,
      getMeasurementSummary: measurementSummary,
''',
'''      setWallThicknessAlignment,
      setWallLengthFromMeasurement,
      setWallConstraint,
      getWallConstraint(itemId) {
        const item = itemFor(itemId), element = elementFor(itemId);
        if (!item || !element || !isWall(element, item)) return null;
        return normalizedWallConstraint(element, lineFor(element, item));
      },
      getWallDimensionGeometry: wallDimensionGeometry,
      getDoorSwingGeometry: doorSwingGeometry,
      selectRoom,
      selectRoomAtPoint,
      get selectedRoomId() { return runtime.selectedRoomId; },
      getMeasurementSummary: measurementSummary,
''',
"public v5 APIs",
)

replace_once(
'''        return { lengthM: line.length, thicknessM: line.thickness };
''',
'''        return { lengthM: line.length, thicknessM: line.thickness, constraint: normalizedWallConstraint(element, line) };
''',
"selected wall metrics constraints",
)

path.write_text(source, encoding="utf-8")

quality = Path("quality_check.py")
quality_source = quality.read_text(encoding="utf-8")
anchor = '        "tests/architectural-cad-v4-runtime.test.cjs",\n'
if 'tests/architectural-cad-v5-runtime.test.cjs' not in quality_source:
    if anchor not in quality_source:
        raise SystemExit("missing quality_check v4 anchor")
    quality_source = quality_source.replace(anchor, anchor + '        "tests/architectural-cad-v5-runtime.test.cjs",\n', 1)
quality.write_text(quality_source, encoding="utf-8")
