from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")

old_runtime = '  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null };'
new_runtime = '  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null, tool: "select", toolAnchor: null, mergeFirstWallId: null, measurementsVisible: true };'
if old_runtime not in source:
    raise SystemExit("runtime anchor not found")
source = source.replace(old_runtime, new_runtime, 1)

anchor = '  function endpointLayer() { return document.getElementById("architecturalEndpointHandles"); }\n'
if anchor not in source:
    raise SystemExit("endpoint layer anchor not found")

block = r'''  function ensureCadPlan() {
    const current = currentState();
    if (!current) return null;
    if (!current.setMasterPlan || !Array.isArray(current.setMasterPlan.elements)) {
      current.setMasterPlan = {
        schema: "frisframe-set-master-plan",
        version: 1,
        status: "ready",
        unit: "meter",
        workflowPolicy: "direct-architectural-cad-v1",
        sourceName: "2.5D CAD",
        generatedItemIds: [],
        elements: [],
        roomZones: [],
      };
    }
    if (!Array.isArray(current.setMasterPlan.generatedItemIds)) current.setMasterPlan.generatedItemIds = [];
    if (!Array.isArray(current.items)) current.items = [];
    if (!Array.isArray(current.setCollections)) current.setCollections = [];
    return current.setMasterPlan;
  }
  function nextCadId(prefix) {
    const used = new Set([
      ...(currentState()?.items || []).map((entry) => String(entry.id)),
      ...(plan()?.elements || []).map((entry) => String(entry.id)),
    ]);
    let index = 1;
    let id = `${prefix}-cad-${index}`;
    while (used.has(id)) id = `${prefix}-cad-${++index}`;
    return id;
  }
  function ensureArchitectureMember(id) {
    const current = currentState();
    if (!current) return;
    if (!Array.isArray(current.setCollections)) current.setCollections = [];
    let collection = current.setCollections.find((entry) => String(entry.id) === "architecture");
    if (!collection) {
      collection = {
        id: "architecture",
        name: "Architecture",
        parentId: "",
        memberIds: [],
        locked: false,
        allowPartialUnlock: true,
        unlockedMemberIds: [],
      };
      current.setCollections.push(collection);
    }
    if (!Array.isArray(collection.memberIds)) collection.memberIds = [];
    if (!Array.isArray(collection.unlockedMemberIds)) collection.unlockedMemberIds = [];
    if (!collection.memberIds.includes(id)) collection.memberIds.push(id);
    if (!collection.unlockedMemberIds.includes(id)) collection.unlockedMemberIds.push(id);
  }
  function registerCadEntity(item, element) {
    const currentPlan = ensureCadPlan();
    const current = currentState();
    if (!currentPlan || !current || !item?.id || !element?.id) return false;
    if (itemFor(item.id) || elementFor(element.id)) return false;
    current.items.push(item);
    currentPlan.elements.push(element);
    if (!currentPlan.generatedItemIds.includes(item.id)) currentPlan.generatedItemIds.push(item.id);
    ensureArchitectureMember(item.id);
    return true;
  }
  function removeCadEntity(id) {
    const current = currentState(), currentPlan = plan();
    if (!current || !currentPlan) return false;
    const beforeItems = current.items.length, beforeElements = currentPlan.elements.length;
    current.items = current.items.filter((entry) => String(entry.id) !== String(id));
    currentPlan.elements = currentPlan.elements.filter((entry) => String(entry.id) !== String(id));
    currentPlan.generatedItemIds = (currentPlan.generatedItemIds || []).filter((entry) => String(entry) !== String(id));
    (current.setCollections || []).forEach((collection) => {
      collection.memberIds = (collection.memberIds || []).filter((entry) => String(entry) !== String(id));
      collection.unlockedMemberIds = (collection.unlockedMemberIds || []).filter((entry) => String(entry) !== String(id));
    });
    return current.items.length !== beforeItems || currentPlan.elements.length !== beforeElements;
  }
  function commitCad(ids) {
    const preserved = [...new Set((ids || []).filter(Boolean).map(String))];
    if (typeof commit === "function") commit({ preserveSourceIds: preserved });
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    syncEndpointHandles();
    syncFields();
    syncMeasurementOverlay();
  }
  function applyWallGeometryOnly(item, element, line) {
    const centerX = (line.sx + line.ex) / 2, centerZ = (line.sz + line.ez) / 2;
    setWorld(item, centerX, centerZ);
    item.facing = ((line.rotation % 360) + 360) % 360;
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = {
      width: line.length,
      height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)),
      depth: line.thickness,
    };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    element.basis = "user_fixed";
    element.confidence = 1;
    writeLine(element, line);
  }
  function createWall(startX, startZ, endX, endZ, options = {}) {
    ensureCadPlan();
    let sx = Number(startX), sz = Number(startZ), ex = Number(endX), ez = Number(endZ);
    if (![sx, sz, ex, ez].every(Number.isFinite)) return false;
    const tolerance = Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M);
    if (options.snap !== false) {
      const startSnap = nearestWallEndpoint(sx, sz, "", tolerance);
      if (startSnap) { sx = startSnap.x; sz = startSnap.z; }
      const endSnap = nearestWallEndpoint(ex, ez, "", tolerance);
      if (endSnap) { ex = endSnap.x; ez = endSnap.z; }
    }
    const length = Math.hypot(ex - sx, ez - sz);
    if (length < 0.1) return false;
    const id = String(options.id || nextCadId("wall"));
    const thickness = clamp(options.thicknessM ?? 0.15, 0.03, 2);
    const height = clamp(options.heightM ?? 2.8, 0.2, 20);
    const rotation = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
    const item = {
      id,
      type: "prop",
      assetType: "wall",
      setKind: "wall",
      name: String(options.name || `벽 ${id.split("-").pop()}`),
      x: 0.5,
      y: 0.5,
      facing: ((rotation % 360) + 360) % 360,
      size: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      mountedHeight: 0,
      referenceDimensionsM: { width: length, height, depth: thickness },
      referenceAnchorId: id,
      motionEnabled: false,
    };
    setWorld(item, (sx + ex) / 2, (sz + ez) / 2);
    const element = {
      id,
      name: item.name,
      kind: "wall",
      role: "structure",
      basis: "user_fixed",
      confidence: 1,
      collectionId: "architecture",
      parentId: "",
      worldXM: (sx + ex) / 2,
      worldZM: (sz + ez) / 2,
      widthM: length,
      heightM: height,
      depthM: thickness,
      rotationDeg: rotation,
      mountedHeightM: 0,
      assetType: "wall",
      line: null,
      notes: "Direct 2.5D CAD wall.",
    };
    writeLine(element, { sx, sz, ex, ez, length, thickness, rotation });
    if (!registerCadEntity(item, element)) return false;
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([id]);
    return id;
  }
  function wallAtPoint(x, z, maxDistanceM = 0.65) {
    let best = null;
    (plan()?.elements || []).forEach((entry) => {
      const item = itemFor(entry.id);
      if (!item || !isWall(entry, item)) return;
      const line = lineFor(entry, item);
      const projection = line ? closestPointOnLine(Number(x), Number(z), line) : null;
      if (!projection || projection.distanceM > maxDistanceM) return;
      if (!best || projection.distanceM < best.distanceM - 1e-9
          || (Math.abs(projection.distanceM - best.distanceM) <= 1e-9 && String(entry.id) < best.wallId)) {
        best = { wallId: String(entry.id), distanceM: projection.distanceM, point: projection };
      }
    });
    return best;
  }
  function splitWall(itemId, worldX, worldZ, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item) || locked(item)) return false;
    const oldLine = lineFor(element, item);
    const split = oldLine ? closestPointOnLine(Number(worldX), Number(worldZ), oldLine) : null;
    if (!split || split.distanceM > Number(options.maxDistanceM || 0.65)) return false;
    if (split.t <= 0.02 || split.t >= 0.98) return false;
    const firstLength = oldLine.length * split.t, secondLength = oldLine.length * (1 - split.t);
    if (firstLength < 0.15 || secondLength < 0.15) return false;
    const childSnapshots = children(itemId).map(({ item: childItem, element: childElement }) => {
      const world = worldOf(childItem);
      const projected = closestPointOnLine(world.x, world.z, oldLine);
      const half = Number(childElement.widthM || dimensions(childItem)?.width || 0) / 2;
      return { item: childItem, element: childElement, world, t: projected?.t ?? 0.5, half };
    });
    if (childSnapshots.some((child) => Math.abs(child.t - split.t) * oldLine.length <= child.half + 0.02)) return false;
    const lineA = {
      sx: oldLine.sx, sz: oldLine.sz, ex: split.x, ez: split.z,
      length: firstLength, thickness: oldLine.thickness,
      rotation: Math.atan2(split.z - oldLine.sz, split.x - oldLine.sx) * 180 / Math.PI,
    };
    const newId = createWall(split.x, split.z, oldLine.ex, oldLine.ez, {
      commit: false,
      snap: false,
      thicknessM: oldLine.thickness,
      heightM: Number(element.heightM || dimensions(item)?.height || 2.8),
      name: `${element.name || item.name || "벽"} B`,
    });
    if (!newId) return false;
    applyWallGeometryOnly(item, element, lineA);
    childSnapshots.forEach((child) => {
      child.element.parentId = child.t <= split.t ? String(itemId) : String(newId);
      setWorld(child.item, child.world.x, child.world.z);
      delete child.element.attachmentT;
      snapOpening(child.item.id);
    });
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([itemId, newId, ...childSnapshots.map((entry) => entry.item.id)]);
    return { wallIds: [String(itemId), String(newId)], split: { xM: split.x, zM: split.z } };
  }
  function angleDelta180(left, right) {
    let delta = Math.abs(((Number(left) - Number(right)) % 180 + 180) % 180);
    if (delta > 90) delta = 180 - delta;
    return delta;
  }
  function mergeWalls(firstId, secondId, options = {}) {
    if (String(firstId) === String(secondId)) return false;
    const firstItem = itemFor(firstId), secondItem = itemFor(secondId);
    const first = elementFor(firstId), second = elementFor(secondId);
    if (!firstItem || !secondItem || !first || !second || !isWall(first, firstItem) || !isWall(second, secondItem)) return false;
    if (locked(firstItem) || locked(secondItem)) return false;
    const lineA = lineFor(first, firstItem), lineB = lineFor(second, secondItem);
    if (!lineA || !lineB || angleDelta180(lineA.rotation, lineB.rotation) > Number(options.angleToleranceDeg || 2)) return false;
    const aPoints = [{ endpoint: "start", x: lineA.sx, z: lineA.sz }, { endpoint: "end", x: lineA.ex, z: lineA.ez }];
    const bPoints = [{ endpoint: "start", x: lineB.sx, z: lineB.sz }, { endpoint: "end", x: lineB.ex, z: lineB.ez }];
    let shared = null;
    aPoints.forEach((a) => bPoints.forEach((b) => {
      const distanceM = Math.hypot(a.x - b.x, a.z - b.z);
      if (!shared || distanceM < shared.distanceM) shared = { a, b, distanceM };
    }));
    if (!shared || shared.distanceM > Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M)) return false;
    const farA = aPoints.find((entry) => entry.endpoint !== shared.a.endpoint);
    const farB = bPoints.find((entry) => entry.endpoint !== shared.b.endpoint);
    const length = Math.hypot(farB.x - farA.x, farB.z - farA.z);
    if (length < 0.1) return false;
    const expected = lineA.length + lineB.length;
    if (Math.abs(length - expected) > Math.max(0.4, shared.distanceM * 2 + 0.05)) return false;
    const childSnapshots = [...children(firstId), ...children(secondId)].map(({ item: childItem, element: childElement }) => ({
      item: childItem,
      element: childElement,
      world: worldOf(childItem),
    }));
    const mergedLine = {
      sx: farA.x, sz: farA.z, ex: farB.x, ez: farB.z,
      length,
      thickness: Math.max(lineA.thickness, lineB.thickness),
      rotation: Math.atan2(farB.z - farA.z, farB.x - farA.x) * 180 / Math.PI,
    };
    applyWallGeometryOnly(firstItem, first, mergedLine);
    childSnapshots.forEach((child) => { child.element.parentId = String(firstId); });
    removeCadEntity(secondId);
    childSnapshots.forEach((child) => {
      setWorld(child.item, child.world.x, child.world.z);
      delete child.element.attachmentT;
      snapOpening(child.item.id);
    });
    refreshRoomZones();
    syncMeasurementOverlay();
    if (options.commit !== false) commitCad([firstId, ...childSnapshots.map((entry) => entry.item.id)]);
    return String(firstId);
  }
  function insertOpening(kind, wallId, worldX, worldZ, options = {}) {
    const openingKind = String(kind || "").toLowerCase();
    if (!OPENING_KINDS.has(openingKind)) return false;
    const wallItem = itemFor(wallId), wall = elementFor(wallId);
    if (!wallItem || !wall || !isWall(wall, wallItem) || locked(wallItem)) return false;
    const line = lineFor(wall, wallItem);
    const defaults = openingKind === "door"
      ? { width: 0.9, height: 2.1, depth: 0.12, mountedHeight: 0 }
      : { width: 1.5, height: 1.2, depth: 0.12, mountedHeight: 0.9 };
    const width = clamp(options.widthM ?? defaults.width, 0.2, 6);
    const height = clamp(options.heightM ?? defaults.height, 0.2, 6);
    const depth = clamp(options.depthM ?? defaults.depth, 0.03, 1);
    const mountedHeight = clamp(options.mountedHeightM ?? defaults.mountedHeight, 0, 6);
    if (!line || line.length < width + 0.04) return false;
    const point = project(Number(worldX), Number(worldZ), line, width / 2);
    if (!point) return false;
    const id = String(options.id || nextCadId(openingKind));
    const item = {
      id,
      type: "prop",
      assetType: openingKind,
      setKind: openingKind,
      name: String(options.name || (openingKind === "door" ? "문" : "창")),
      x: 0.5,
      y: 0.5,
      facing: ((line.rotation % 360) + 360) % 360,
      size: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      mountedHeight,
      referenceDimensionsM: { width, height, depth },
      referenceAnchorId: id,
      motionEnabled: false,
    };
    setWorld(item, point.x, point.z);
    const element = {
      id,
      name: item.name,
      kind: openingKind,
      role: "opening",
      basis: "user_fixed",
      confidence: 1,
      collectionId: "architecture",
      parentId: String(wallId),
      worldXM: point.x,
      worldZM: point.z,
      widthM: width,
      heightM: height,
      depthM: depth,
      rotationDeg: line.rotation,
      mountedHeightM: mountedHeight,
      attachmentT: point.t,
      assetType: openingKind,
      line: null,
      notes: "Direct 2.5D CAD opening.",
    };
    if (!registerCadEntity(item, element)) return false;
    refreshRoomZones();
    if (options.commit !== false) commitCad([wallId, id]);
    return id;
  }
  function roomCentroid(room) {
    const points = Array.isArray(room?.points) ? room.points : [];
    if (!points.length) return { x: 0, z: 0 };
    return points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 })
      |> ((sum) => ({ x: sum.x / points.length, z: sum.z / points.length }));
  }
  function measurementSummary() {
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
  function measurementLayer() { return document.getElementById("architecturalCadMeasurements"); }
  function syncMeasurementOverlay() {
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
  function setMeasurementsVisible(value) {
    runtime.measurementsVisible = Boolean(value);
    syncMeasurementOverlay();
    syncToolUi();
    return runtime.measurementsVisible;
  }
  function sketchLayer() { return document.getElementById("architecturalCadSketchLayer"); }
  function toolbox() { return document.getElementById("architecturalCadToolbox"); }
  function setTool(tool) {
    const value = String(tool || "select");
    if (!["select", "wall", "split", "merge", "door", "window"].includes(value)) return false;
    runtime.tool = value;
    runtime.toolAnchor = null;
    runtime.mergeFirstWallId = null;
    syncToolUi();
    syncEndpointHandles();
    return true;
  }
  function syncToolUi() {
    const bar = toolbox(), layer = sketchLayer();
    const active25d = root.FrisFrameBirdseye25D?.mode === "2.5d";
    if (bar) {
      bar.hidden = !active25d;
      bar.style.display = active25d ? "inline-flex" : "none";
      (bar.children || []).forEach?.((child) => {
        if (child?.dataset?.architecturalTool) child.dataset.active = child.dataset.architecturalTool === runtime.tool ? "true" : "false";
        if (child?.dataset?.measurementToggle) child.dataset.active = runtime.measurementsVisible ? "true" : "false";
      });
    }
    if (layer) {
      const activeTool = active25d && runtime.tool !== "select";
      layer.style.pointerEvents = activeTool ? "auto" : "none";
      layer.style.cursor = activeTool ? "crosshair" : "default";
    }
  }
  function snappedSketchPoint(point) {
    const target = nearestWallEndpoint(point.x, point.z, "", ENDPOINT_SNAP_TOLERANCE_M);
    return target ? { x: target.x, z: target.z } : point;
  }
  function notifyCad(message) {
    if (typeof notifyApp === "function") notifyApp(message);
  }
  function handleSketchPointer(event) {
    if (runtime.tool === "select") return;
    const point = pointerWorldPoint(event);
    if (!point) return;
    if (runtime.tool === "wall") {
      const target = snappedSketchPoint(point);
      if (!runtime.toolAnchor) {
        runtime.toolAnchor = target;
        notifyCad("벽 시작점을 지정했습니다. 끝점을 클릭하세요.");
      } else {
        const id = createWall(runtime.toolAnchor.x, runtime.toolAnchor.z, target.x, target.z, { commit: true, snap: true });
        if (id) {
          const line = lineFor(elementFor(id), itemFor(id));
          runtime.toolAnchor = { x: line.ex, z: line.ez };
          notifyCad("벽을 추가했습니다. 계속 클릭하면 연결해서 그립니다.");
        }
      }
    } else if (runtime.tool === "split") {
      const target = wallAtPoint(point.x, point.z, 0.55);
      if (target && splitWall(target.wallId, target.point.x, target.point.z, { commit: true })) notifyCad("벽을 분할했습니다.");
    } else if (runtime.tool === "merge") {
      const target = wallAtPoint(point.x, point.z, 0.55);
      if (target) {
        if (!runtime.mergeFirstWallId) {
          runtime.mergeFirstWallId = target.wallId;
          notifyCad("합칠 첫 번째 벽을 선택했습니다.");
        } else if (target.wallId !== runtime.mergeFirstWallId) {
          if (mergeWalls(runtime.mergeFirstWallId, target.wallId, { commit: true })) notifyCad("두 벽을 합쳤습니다.");
          else notifyCad("일직선으로 이어진 벽만 합칠 수 있습니다.");
          runtime.mergeFirstWallId = null;
        }
      }
    } else if (runtime.tool === "door" || runtime.tool === "window") {
      const target = wallAtPoint(point.x, point.z, OPENING_REATTACH_TOLERANCE_M);
      if (target && insertOpening(runtime.tool, target.wallId, target.point.x, target.point.z, { commit: true })) {
        notifyCad(runtime.tool === "door" ? "문을 벽에 삽입했습니다." : "창을 벽에 삽입했습니다.");
      }
    }
    syncMeasurementOverlay();
    event.preventDefault?.();
    event.stopPropagation?.();
  }
  function installCadToolbox() {
    const controls = document.getElementById("birdseyeCadControls"), wrap = document.getElementById("threeWrap");
    if (!controls || !wrap) return false;
    if (!toolbox()) {
      const bar = document.createElement("span");
      bar.id = "architecturalCadToolbox";
      bar.style.cssText = "display:inline-flex;align-items:center;gap:4px;white-space:nowrap";
      [["select", "선택"], ["wall", "벽"], ["split", "분할"], ["merge", "합치기"], ["door", "문"], ["window", "창"]].forEach(([tool, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.architecturalTool = tool;
        button.textContent = label;
        button.title = `2.5D CAD · ${label}`;
        button.addEventListener("click", () => setTool(tool));
        bar.appendChild(button);
      });
      const measures = document.createElement("button");
      measures.type = "button";
      measures.dataset.measurementToggle = "true";
      measures.textContent = "치수";
      measures.title = "벽 길이와 방 면적 표시";
      measures.addEventListener("click", () => setMeasurementsVisible(!runtime.measurementsVisible));
      bar.appendChild(measures);
      const readout = document.getElementById("birdseyeCadReadout");
      controls.insertBefore(bar, readout || null);
    }
    if (!sketchLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadSketchLayer";
      layer.style.cssText = "position:absolute;inset:0;z-index:54;pointer-events:none";
      layer.addEventListener("pointerdown", handleSketchPointer);
      wrap.appendChild(layer);
    }
    if (!measurementLayer()) {
      const layer = document.createElement("div");
      layer.id = "architecturalCadMeasurements";
      layer.style.cssText = "position:absolute;inset:0;z-index:53;pointer-events:none";
      wrap.appendChild(layer);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && runtime.tool !== "select") {
        runtime.toolAnchor = null;
        runtime.mergeFirstWallId = null;
        setTool("select");
      }
    });
    syncToolUi();
    return true;
  }
'''

# Avoid the unsupported pipeline operator in browser JS before writing.
block = block.replace('    return points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 })\n      |> ((sum) => ({ x: sum.x / points.length, z: sum.z / points.length }));\n', '    const sum = points.reduce((acc, point) => ({ x: acc.x + Number(point.xM || 0), z: acc.z + Number(point.zM || 0) }), { x: 0, z: 0 });\n    return { x: sum.x / points.length, z: sum.z / points.length };\n')

source = source.replace(anchor, block + anchor, 1)

old_show = '    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && item && element && isWall(element, item);'
new_show = '    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && runtime.tool === "select" && item && element && isWall(element, item);'
if old_show not in source:
    raise SystemExit("endpoint visibility anchor not found")
source = source.replace(old_show, new_show, 1)

old_render = '        requestAnimationFrame?.(syncEndpointHandles);'
new_render = '        requestAnimationFrame?.(() => { syncEndpointHandles(); syncMeasurementOverlay(); syncToolUi(); });'
if old_render not in source:
    raise SystemExit("render hook anchor not found")
source = source.replace(old_render, new_render, 1)

old_install = '    if (!installEndpointHandles()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    installHooks(); refreshRoomZones(); syncFields(); syncEndpointHandles();'
new_install = '    if (!installEndpointHandles()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    if (!installCadToolbox()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    installHooks(); refreshRoomZones(); syncFields(); syncEndpointHandles(); syncMeasurementOverlay(); syncToolUi();'
if old_install not in source:
    raise SystemExit("install anchor not found")
source = source.replace(old_install, new_install, 1)

old_api = '''      reattachOpeningToNearestWall: reattachOpening,\n      setWallEndpoint,\n      get lastEndpointSnap() { return runtime.lastEndpointSnap; },\n      setWallMetrics,'''
new_api = '''      reattachOpeningToNearestWall: reattachOpening,\n      createWall,\n      splitWall,\n      mergeWalls,\n      insertOpening,\n      getMeasurementSummary: measurementSummary,\n      setMeasurementsVisible,\n      setTool,\n      get activeTool() { return runtime.tool; },\n      setWallEndpoint,\n      get lastEndpointSnap() { return runtime.lastEndpointSnap; },\n      setWallMetrics,'''
if old_api not in source:
    raise SystemExit("API anchor not found")
source = source.replace(old_api, new_api, 1)

path.write_text(source, encoding="utf-8")

quality = Path("quality_check.py")
q = quality.read_text(encoding="utf-8")
needle = '        "tests/architectural-cad-v2-runtime.test.cjs",\n'
if needle not in q:
    raise SystemExit("quality gate anchor not found")
q = q.replace(needle, needle + '        "tests/architectural-cad-v3-runtime.test.cjs",\n', 1)
quality.write_text(q, encoding="utf-8")
