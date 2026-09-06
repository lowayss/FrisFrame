(function initBirdseyeArchitecturalCad(root) {
  "use strict";

  if (!root || typeof document === "undefined") return;

  const WALL_KINDS = new Set(["wall", "partition", "railing"]);
  const OPENING_KINDS = new Set(["door", "window"]);
  const ROOM_NODE_TOLERANCE_M = 0.03;
  const MIN_ROOM_AREA_M2 = 0.25;
  const architectural = {
    installed: false,
    reconciling: false,
    originalCommit: null,
    originalUpdateThreeEditorDrag: null,
    originalSyncUi: null,
    originalRenderThreeView: null,
    installAttempts: 0,
  };

  function currentState() {
    return typeof state !== "undefined" ? state : null;
  }

  function stageSize(renderState = currentState()) {
    if (typeof stageWorldSize === "function" && renderState) return stageWorldSize(renderState);
    return { width: 36, depth: 20.25 };
  }

  function birdseyeActive() {
    return root.FrisFrameBirdseye25D?.mode === "2.5d";
  }

  function masterPlan(renderState = currentState()) {
    const plan = renderState?.setMasterPlan;
    return plan && Array.isArray(plan.elements) ? plan : null;
  }

  function elementFor(itemId, renderState = currentState()) {
    const plan = masterPlan(renderState);
    if (!plan || !itemId) return null;
    return plan.elements.find((entry) => String(entry?.id) === String(itemId)) || null;
  }

  function itemFor(itemId, renderState = currentState()) {
    return renderState?.items?.find?.((entry) => String(entry?.id) === String(itemId)) || null;
  }

  function selectedItem(renderState = currentState()) {
    if (!renderState || typeof selected === "undefined" || !selected?.id) return null;
    if (!["item", "facing"].includes(selected.kind)) return null;
    const id = typeof transformLeaderIdForItem === "function"
      ? (transformLeaderIdForItem(selected.id, renderState) || selected.id)
      : selected.id;
    return itemFor(id, renderState);
  }

  function elementKind(element, item) {
    return String(element?.kind || item?.setKind || item?.kind || item?.assetType || "").toLowerCase();
  }

  function isWall(element, item) {
    return WALL_KINDS.has(elementKind(element, item));
  }

  function isOpening(element, item) {
    return OPENING_KINDS.has(elementKind(element, item));
  }

  function itemLocked(item) {
    if (!item) return true;
    if (typeof sourceEditLocked === "function") return Boolean(sourceEditLocked(item.id));
    return Boolean(item.editLocked);
  }

  function notifyLocked(item) {
    if (!item) return;
    if (typeof notifyEditLocked === "function") notifyEditLocked(item.name || "대상");
    else if (typeof notifyApp === "function") notifyApp(`${item.name || "대상"}은(는) 잠겨 있습니다.`);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function worldPosition(item, renderState = currentState()) {
    if (!item) return { x: 0, z: 0 };
    const pose = typeof resolvedItemPose === "function" ? resolvedItemPose(item, renderState) : item;
    const size = stageSize(renderState);
    return {
      x: (Number(pose?.x ?? item.x ?? 0.5) - 0.5) * size.width,
      z: (Number(pose?.y ?? item.y ?? 0.5) - 0.5) * size.depth,
    };
  }

  function setItemWorldPosition(item, x, z, renderState = currentState()) {
    const size = stageSize(renderState);
    const min = typeof STAGE_COORD_MIN !== "undefined" ? Number(STAGE_COORD_MIN) : 0.02;
    const max = typeof STAGE_COORD_MAX !== "undefined" ? Number(STAGE_COORD_MAX) : 0.98;
    item.x = clamp(0.5 + Number(x) / size.width, min, max);
    item.y = clamp(0.5 + Number(z) / size.depth, min, max);
  }

  function persistedDimensions(item) {
    const dims = item?.referenceDimensionsM || item?.physicalDimensionsM;
    if (!dims) return null;
    return {
      width: Number(dims.width || 0),
      height: Number(dims.height || 0),
      depth: Number(dims.depth || 0),
    };
  }

  function lineFor(element, item, renderState = currentState()) {
    const raw = element?.line;
    if (raw && [raw.start_x_m, raw.start_z_m, raw.end_x_m, raw.end_z_m].every(Number.isFinite)) {
      const sx = Number(raw.start_x_m);
      const sz = Number(raw.start_z_m);
      const ex = Number(raw.end_x_m);
      const ez = Number(raw.end_z_m);
      const length = Math.hypot(ex - sx, ez - sz);
      if (length > 1e-6) {
        return {
          sx, sz, ex, ez, length,
          thickness: Number(raw.thickness_m || element?.depthM || 0.15),
          rotation: Math.atan2(ez - sz, ex - sx) * 180 / Math.PI,
        };
      }
    }
    if (!item && !element) return null;
    const center = item ? worldPosition(item, renderState) : {
      x: Number(element?.worldXM || 0),
      z: Number(element?.worldZM || 0),
    };
    const dims = persistedDimensions(item);
    const length = Math.max(0.02, Number(element?.widthM || dims?.width || 1));
    const thickness = Math.max(0.01, Number(element?.depthM || dims?.depth || 0.15));
    const rotation = Number(item?.facing ?? element?.rotationDeg ?? 0);
    const radians = rotation * Math.PI / 180;
    const hx = Math.cos(radians) * length / 2;
    const hz = Math.sin(radians) * length / 2;
    return {
      sx: center.x - hx,
      sz: center.z - hz,
      ex: center.x + hx,
      ez: center.z + hz,
      length,
      thickness,
      rotation,
    };
  }

  function projectPointToLine(x, z, line, halfWidth = 0) {
    const dx = line.ex - line.sx;
    const dz = line.ez - line.sz;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 1e-9) return null;
    const rawT = ((x - line.sx) * dx + (z - line.sz) * dz) / lengthSq;
    const inset = line.length > 1e-6 ? Math.min(0.49, Math.max(0, halfWidth / line.length)) : 0;
    const t = clamp(rawT, inset, 1 - inset);
    return {
      t,
      x: line.sx + dx * t,
      z: line.sz + dz * t,
      distanceM: Math.hypot(x - (line.sx + dx * t), z - (line.sz + dz * t)),
    };
  }

  function updateOpeningElement(item, element, parentElement, point) {
    if (!item || !element || !point) return;
    const parentItem = itemFor(parentElement?.id);
    const parentLine = lineFor(parentElement, parentItem);
    const rotation = parentLine?.rotation ?? Number(parentElement?.rotationDeg || item.facing || 0);
    item.facing = ((rotation % 360) + 360) % 360;
    element.parentId = String(parentElement.id);
    element.worldXM = point.x;
    element.worldZM = point.z;
    element.rotationDeg = rotation;
    element.attachmentT = point.t;
  }

  function snapOpeningToParent(itemId, renderState = currentState()) {
    const item = itemFor(itemId, renderState);
    const element = elementFor(itemId, renderState);
    if (!item || !element || !isOpening(element, item) || !element.parentId) return false;
    const parentElement = elementFor(element.parentId, renderState);
    const parentItem = itemFor(element.parentId, renderState);
    if (!parentElement || !parentItem || !isWall(parentElement, parentItem)) return false;
    const line = lineFor(parentElement, parentItem, renderState);
    if (!line) return false;
    const world = worldPosition(item, renderState);
    const dims = persistedDimensions(item);
    const halfWidth = Math.max(0, Number(element.widthM || dims?.width || 0) / 2);
    const point = projectPointToLine(world.x, world.z, line, halfWidth);
    if (!point) return false;
    const changed = Math.hypot(world.x - point.x, world.z - point.z) > 1e-7
      || Math.abs(Number(item.facing || 0) - line.rotation) > 1e-7;
    setItemWorldPosition(item, point.x, point.z, renderState);
    updateOpeningElement(item, element, parentElement, point);
    return changed;
  }

  function childOpenings(parentId, renderState = currentState()) {
    const plan = masterPlan(renderState);
    if (!plan) return [];
    return plan.elements
      .filter((entry) => String(entry?.parentId || "") === String(parentId) && OPENING_KINDS.has(String(entry?.kind || "")))
      .map((entry) => ({ element: entry, item: itemFor(entry.id, renderState) }))
      .filter((entry) => entry.item);
  }

  function setElementLine(element, line) {
    if (!element || !line) return;
    element.worldXM = (line.sx + line.ex) / 2;
    element.worldZM = (line.sz + line.ez) / 2;
    element.widthM = line.length;
    element.depthM = line.thickness;
    element.rotationDeg = line.rotation;
    element.line = {
      start_x_m: line.sx,
      start_z_m: line.sz,
      end_x_m: line.ex,
      end_z_m: line.ez,
      length_m: line.length,
      thickness_m: line.thickness,
    };
  }

  function applyWallDimensions(item, element, line) {
    const current = persistedDimensions(item) || { width: line.length, height: Number(element?.heightM || 2.8), depth: line.thickness };
    item.referenceDimensionsM = {
      width: line.length,
      height: Math.max(0.02, Number(current.height || element?.heightM || 2.8)),
      depth: line.thickness,
    };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    item.facing = ((line.rotation % 360) + 360) % 360;
    setElementLine(element, line);
  }

  function moveChildrenWithWall(parentId, oldLine, nextLine, renderState = currentState()) {
    childOpenings(parentId, renderState).forEach(({ item, element }) => {
      const world = worldPosition(item, renderState);
      const dims = persistedDimensions(item);
      const halfWidth = Math.max(0, Number(element.widthM || dims?.width || 0) / 2);
      const oldPoint = projectPointToLine(world.x, world.z, oldLine, halfWidth);
      const t = Number.isFinite(element.attachmentT) ? clamp(element.attachmentT, 0, 1) : (oldPoint?.t ?? 0.5);
      const inset = nextLine.length > 1e-6 ? Math.min(0.49, halfWidth / nextLine.length) : 0;
      const safeT = clamp(t, inset, 1 - inset);
      const x = nextLine.sx + (nextLine.ex - nextLine.sx) * safeT;
      const z = nextLine.sz + (nextLine.ez - nextLine.sz) * safeT;
      setItemWorldPosition(item, x, z, renderState);
      updateOpeningElement(item, element, elementFor(parentId, renderState), { x, z, t: safeT });
      const openingDims = persistedDimensions(item);
      if (openingDims && Math.abs(openingDims.depth - oldLine.thickness) <= 0.06) {
        item.referenceDimensionsM = { ...openingDims, depth: nextLine.thickness };
        if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
        element.depthM = nextLine.thickness;
      }
    });
  }

  function reconcileWallFromItem(item, element, renderState = currentState()) {
    if (!item || !element || !isWall(element, item)) return false;
    const oldLine = lineFor(element, null, renderState) || lineFor(element, item, renderState);
    if (!oldLine) return false;
    const center = worldPosition(item, renderState);
    const dims = persistedDimensions(item);
    const length = Math.max(0.1, Number(element.widthM || dims?.width || oldLine.length));
    const thickness = Math.max(0.03, Number(element.depthM || dims?.depth || oldLine.thickness));
    const rotation = Number(item.facing ?? element.rotationDeg ?? oldLine.rotation);
    const radians = rotation * Math.PI / 180;
    const hx = Math.cos(radians) * length / 2;
    const hz = Math.sin(radians) * length / 2;
    const nextLine = {
      sx: center.x - hx,
      sz: center.z - hz,
      ex: center.x + hx,
      ez: center.z + hz,
      length,
      thickness,
      rotation,
    };
    const changed = Math.hypot(oldLine.sx - nextLine.sx, oldLine.sz - nextLine.sz)
      + Math.hypot(oldLine.ex - nextLine.ex, oldLine.ez - nextLine.ez) > 1e-7;
    if (!changed) return false;
    setElementLine(element, nextLine);
    moveChildrenWithWall(item.id, oldLine, nextLine, renderState);
    return true;
  }

  function polygonArea(points) {
    let area2 = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      area2 += a.x * b.z - b.x * a.z;
    }
    return area2 / 2;
  }

  function polygonPerimeter(points) {
    let perimeter = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      perimeter += Math.hypot(a.x - b.x, a.z - b.z);
    }
    return perimeter;
  }

  function deriveRoomZones(renderState = currentState()) {
    const plan = masterPlan(renderState);
    if (!plan) return [];
    const walls = plan.elements
      .filter((entry) => WALL_KINDS.has(String(entry?.kind || "")))
      .map((entry) => ({ element: entry, line: lineFor(entry, itemFor(entry.id, renderState), renderState) }))
      .filter((entry) => entry.line && entry.line.length > 0.05);
    if (walls.length < 3) return [];

    const nodes = [];
    const edges = [];
    function nodeFor(x, z) {
      const existing = nodes.findIndex((node) => Math.hypot(node.x - x, node.z - z) <= ROOM_NODE_TOLERANCE_M);
      if (existing >= 0) return existing;
      nodes.push({ x, z });
      return nodes.length - 1;
    }
    walls.forEach(({ element, line }) => {
      const a = nodeFor(line.sx, line.sz);
      const b = nodeFor(line.ex, line.ez);
      if (a !== b) edges.push({ a, b, wallId: String(element.id) });
    });

    const neighbors = nodes.map(() => []);
    const wallByPair = new Map();
    edges.forEach((edge) => {
      neighbors[edge.a].push(edge.b);
      neighbors[edge.b].push(edge.a);
      wallByPair.set(`${Math.min(edge.a, edge.b)}:${Math.max(edge.a, edge.b)}`, edge.wallId);
    });
    neighbors.forEach((list, nodeId) => {
      list.sort((left, right) => {
        const a = Math.atan2(nodes[left].z - nodes[nodeId].z, nodes[left].x - nodes[nodeId].x);
        const b = Math.atan2(nodes[right].z - nodes[nodeId].z, nodes[right].x - nodes[nodeId].x);
        return a - b;
      });
    });

    const visited = new Set();
    const faces = [];
    edges.forEach((edge) => {
      [[edge.a, edge.b], [edge.b, edge.a]].forEach(([startA, startB]) => {
        const startKey = `${startA}>${startB}`;
        if (visited.has(startKey)) return;
        const polygonNodes = [];
        const wallIds = [];
        let a = startA;
        let b = startB;
        for (let guard = 0; guard < edges.length * 4 + 8; guard += 1) {
          const key = `${a}>${b}`;
          if (visited.has(key) && key !== startKey) break;
          visited.add(key);
          polygonNodes.push(a);
          wallIds.push(wallByPair.get(`${Math.min(a, b)}:${Math.max(a, b)}`) || "");
          const options = neighbors[b];
          const reverseIndex = options.indexOf(a);
          if (reverseIndex < 0 || !options.length) break;
          const next = options[(reverseIndex - 1 + options.length) % options.length];
          a = b;
          b = next;
          if (a === startA && b === startB) {
            const points = polygonNodes.map((nodeId) => nodes[nodeId]);
            const signedArea = polygonArea(points);
            if (points.length >= 3 && signedArea > MIN_ROOM_AREA_M2) {
              faces.push({ points, wallIds: [...new Set(wallIds.filter(Boolean))], area: signedArea });
            }
            break;
          }
        }
      });
    });

    return faces
      .sort((left, right) => right.area - left.area)
      .map((face, index) => ({
        id: `room-zone-${index + 1}`,
        name: `Room ${index + 1}`,
        points: face.points.map((point) => ({ xM: Number(point.x.toFixed(4)), zM: Number(point.z.toFixed(4)) })),
        areaM2: Number(face.area.toFixed(4)),
        perimeterM: Number(polygonPerimeter(face.points).toFixed(4)),
        wallIds: face.wallIds,
        basis: "derived-closed-wall-loop",
      }));
  }

  function refreshRoomZones(renderState = currentState()) {
    const plan = masterPlan(renderState);
    if (!plan) return [];
    const zones = deriveRoomZones(renderState);
    plan.roomZones = zones;
    return zones;
  }

  function reconcileArchitecture(renderState = currentState()) {
    if (architectural.reconciling || !renderState) return false;
    architectural.reconciling = true;
    try {
      const plan = masterPlan(renderState);
      if (!plan) return false;
      let changed = false;
      plan.elements.forEach((element) => {
        const item = itemFor(element.id, renderState);
        if (item && isWall(element, item)) changed = reconcileWallFromItem(item, element, renderState) || changed;
      });
      plan.elements.forEach((element) => {
        const item = itemFor(element.id, renderState);
        if (item && isOpening(element, item) && element.parentId) changed = snapOpeningToParent(item.id, renderState) || changed;
      });
      refreshRoomZones(renderState);
      return changed;
    } finally {
      architectural.reconciling = false;
    }
  }

  function commitPreserving(ids) {
    if (typeof commit !== "function") return;
    commit({ preserveSourceIds: [...new Set(ids.map(String))] });
  }

  function setWallMetrics(itemId, lengthM, thicknessM) {
    const renderState = currentState();
    const item = itemFor(itemId, renderState);
    const element = elementFor(itemId, renderState);
    if (!item || !element || !isWall(element, item)) return false;
    if (itemLocked(item)) {
      notifyLocked(item);
      return false;
    }
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const oldLine = lineFor(element, item, renderState);
    if (!oldLine) return false;
    const nextLength = clamp(lengthM ?? oldLine.length, 0.10, 100);
    const nextThickness = clamp(thicknessM ?? oldLine.thickness, 0.03, 2.0);
    const centerX = (oldLine.sx + oldLine.ex) / 2;
    const centerZ = (oldLine.sz + oldLine.ez) / 2;
    const radians = oldLine.rotation * Math.PI / 180;
    const hx = Math.cos(radians) * nextLength / 2;
    const hz = Math.sin(radians) * nextLength / 2;
    const nextLine = {
      sx: centerX - hx,
      sz: centerZ - hz,
      ex: centerX + hx,
      ez: centerZ + hz,
      length: nextLength,
      thickness: nextThickness,
      rotation: oldLine.rotation,
    };
    applyWallDimensions(item, element, nextLine);
    moveChildrenWithWall(item.id, oldLine, nextLine, renderState);
    refreshRoomZones(renderState);
    const affected = [item.id, ...childOpenings(item.id, renderState).map((entry) => entry.item.id)];
    commitPreserving(affected);
    if (typeof syncUi === "function") syncUi(false);
    if (typeof renderThreeView === "function") {
      const frame = typeof currentInteractionFrame === "function" ? currentInteractionFrame() : renderState;
      renderThreeView(frame, true);
    }
    syncControls();
    return true;
  }

  function injectStyles() {
    if (document.getElementById("frisframeArchitecturalCadStyles")) return;
    const style = document.createElement("style");
    style.id = "frisframeArchitecturalCadStyles";
    style.textContent = `
      #architecturalCadFields { display: inline-flex; align-items: center; gap: 5px; }
      #architecturalCadFields[hidden] { display: none !important; }
      #architecturalCadFields label { display: inline-flex; align-items: center; gap: 4px; color: #94a8b2; white-space: nowrap; }
      #architecturalCadFields input { width: 66px; min-height: 27px; box-sizing: border-box; border: 1px solid rgba(150,171,183,.24); border-radius: 6px; background: rgba(28,39,46,.94); color: #e4eef2; padding: 0 5px; font: 800 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
      #architecturalRoomBadge { color: #a9c8d6; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  function installControls() {
    const controls = document.getElementById("birdseyeCadControls");
    if (!controls || document.getElementById("architecturalCadFields")) return Boolean(controls);
    const divider = document.createElement("span");
    divider.className = "cad-divider";
    divider.dataset.archCad = "divider";
    const fields = document.createElement("span");
    fields.id = "architecturalCadFields";
    fields.hidden = true;

    const lengthLabel = document.createElement("label");
    lengthLabel.textContent = "벽 길이";
    const lengthInput = document.createElement("input");
    lengthInput.id = "wallLengthM";
    lengthInput.type = "number";
    lengthInput.min = "0.10";
    lengthInput.max = "100";
    lengthInput.step = "0.05";
    lengthInput.setAttribute("aria-label", "선택한 벽 길이 미터");
    lengthLabel.appendChild(lengthInput);

    const thicknessLabel = document.createElement("label");
    thicknessLabel.textContent = "두께";
    const thicknessInput = document.createElement("input");
    thicknessInput.id = "wallThicknessM";
    thicknessInput.type = "number";
    thicknessInput.min = "0.03";
    thicknessInput.max = "2";
    thicknessInput.step = "0.01";
    thicknessInput.setAttribute("aria-label", "선택한 벽 두께 미터");
    thicknessLabel.appendChild(thicknessInput);

    const roomBadge = document.createElement("span");
    roomBadge.id = "architecturalRoomBadge";
    fields.append(lengthLabel, thicknessLabel, roomBadge);
    const readout = document.getElementById("birdseyeCadReadout");
    controls.insertBefore(divider, readout || null);
    controls.insertBefore(fields, readout || null);

    function applyInputs() {
      const item = selectedItem();
      if (!item) return;
      setWallMetrics(item.id, Number(lengthInput.value), Number(thicknessInput.value));
    }
    lengthInput.addEventListener("change", applyInputs);
    thicknessInput.addEventListener("change", applyInputs);
    return true;
  }

  function syncControls() {
    const fields = document.getElementById("architecturalCadFields");
    if (!fields) return;
    const item = selectedItem();
    const element = item ? elementFor(item.id) : null;
    const wall = item && element && isWall(element, item);
    fields.hidden = !(birdseyeActive() && wall);
    if (!wall) return;
    const line = lineFor(element, item);
    const lengthInput = document.getElementById("wallLengthM");
    const thicknessInput = document.getElementById("wallThicknessM");
    if (line && document.activeElement !== lengthInput) lengthInput.value = line.length.toFixed(2);
    if (line && document.activeElement !== thicknessInput) thicknessInput.value = line.thickness.toFixed(2);
    const badge = document.getElementById("architecturalRoomBadge");
    if (badge) badge.textContent = `방 ${masterPlan()?.roomZones?.length || 0}`;
  }

  function removeRoomOverlay() {
    if (typeof threeView === "undefined" || !threeView?.world) return;
    const old = threeView.world.getObjectByName?.("architecturalRoomZones");
    if (!old) return;
    old.traverse?.((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose?.());
    });
    old.parent?.remove(old);
  }

  function renderRoomOverlay() {
    removeRoomOverlay();
    if (!birdseyeActive() || !root.THREE || typeof threeView === "undefined" || !threeView?.world) return;
    const zones = masterPlan()?.roomZones;
    if (!Array.isArray(zones) || !zones.length) return;
    const THREE = root.THREE;
    const group = new THREE.Group();
    group.name = "architecturalRoomZones";
    group.userData.previewHidden = true;
    zones.forEach((zone) => {
      const points = Array.isArray(zone.points) ? zone.points : [];
      if (points.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(points[0].xM, points[0].zM);
      for (let index = 1; index < points.length; index += 1) shape.lineTo(points[index].xM, points[index].zM);
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({
        color: 0x8fc8df,
        transparent: true,
        opacity: 0.10,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.018;
      mesh.renderOrder = 2;
      mesh.raycast = () => {};
      mesh.userData.previewHidden = true;
      group.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xaed8e8, transparent: true, opacity: 0.42, depthWrite: false }),
      );
      edge.position.y = 0.02;
      edge.renderOrder = 3;
      edge.raycast = () => {};
      edge.userData.previewHidden = true;
      group.add(edge);
    });
    threeView.world.add(group);
  }

  function installFunctionHooks() {
    if (typeof commit === "function") {
      architectural.originalCommit = commit;
      commit = function commitArchitecturalState(...args) {
        reconcileArchitecture();
        return architectural.originalCommit(...args);
      };
    }
    if (typeof updateThreeEditorDrag === "function") {
      architectural.originalUpdateThreeEditorDrag = updateThreeEditorDrag;
      updateThreeEditorDrag = function updateArchitecturalDrag(...args) {
        const result = architectural.originalUpdateThreeEditorDrag(...args);
        if (birdseyeActive() && typeof threeDrag !== "undefined" && threeDrag?.kind === "edit" && !threeDrag.pending) {
          const itemId = threeDrag.editItemId || threeDrag.editor?.id;
          const item = itemFor(itemId);
          const element = elementFor(itemId);
          if (item && element) {
            if (isOpening(element, item)) snapOpeningToParent(item.id);
            if (isWall(element, item)) reconcileWallFromItem(item, element);
            refreshRoomZones();
            if (typeof renderThreeView === "function") {
              const frame = typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState();
              renderThreeView(frame, true);
            }
          }
        }
        syncControls();
        return result;
      };
    }
    if (typeof syncUi === "function") {
      architectural.originalSyncUi = syncUi;
      syncUi = function syncArchitecturalUi(...args) {
        const result = architectural.originalSyncUi(...args);
        reconcileArchitecture();
        syncControls();
        return result;
      };
    }
    if (typeof renderThreeView === "function") {
      architectural.originalRenderThreeView = renderThreeView;
      renderThreeView = function renderArchitecturalThreeView(...args) {
        const result = architectural.originalRenderThreeView(...args);
        refreshRoomZones();
        renderRoomOverlay();
        syncControls();
        return result;
      };
    }
  }

  function install() {
    if (architectural.installed) return;
    architectural.installAttempts += 1;
    if (!root.FrisFrameBirdseyeCad || typeof updateThreeEditorDrag !== "function" || typeof commit !== "function") {
      if (architectural.installAttempts < 80) setTimeout(install, 50);
      return;
    }
    injectStyles();
    if (!installControls()) {
      if (architectural.installAttempts < 80) setTimeout(install, 50);
      return;
    }
    installFunctionHooks();
    refreshRoomZones();
    renderRoomOverlay();
    syncControls();
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#viewButtons, #threeCanvas, #birdseyeCadControls")) requestAnimationFrame(syncControls);
    });
    architectural.installed = true;
    root.FrisFrameArchitecturalCad = {
      get roomZones() { return masterPlan()?.roomZones || []; },
      deriveRoomZones,
      refreshRoomZones,
      reconcile: reconcileArchitecture,
      snapOpeningToParent,
      setWallMetrics,
      getSelectedWallMetrics() {
        const item = selectedItem();
        const element = item ? elementFor(item.id) : null;
        if (!item || !element || !isWall(element, item)) return null;
        const line = lineFor(element, item);
        return line ? { lengthM: line.length, thicknessM: line.thickness } : null;
      },
    };
  }

  root.addEventListener("load", install, { once: true });
})(window);
