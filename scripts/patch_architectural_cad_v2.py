#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source_path = ROOT / "multi-camera-core.js"
quality_path = ROOT / "quality_check.py"
source = source_path.read_text(encoding="utf-8")
quality = quality_path.read_text(encoding="utf-8")

runtime_old = '  const runtime = { installed: false, reconciling: false, attempts: 0 };'
runtime_new = '''  const ENDPOINT_SNAP_TOLERANCE_M = 0.18;
  const OPENING_REATTACH_TOLERANCE_M = 0.65;
  const runtime = { installed: false, reconciling: false, attempts: 0, endpointDrag: null, lastEndpointSnap: null };'''
assert runtime_old in source
source = source.replace(runtime_old, runtime_new, 1)

snap_anchor = '  function snapOpening(id) {'
assert snap_anchor in source
helpers = r'''  function closestPointOnLine(x, z, line) {
    const dx = line.ex - line.sx, dz = line.ez - line.sz;
    const d2 = dx * dx + dz * dz;
    if (d2 <= 1e-9) return null;
    const t = clamp(((x - line.sx) * dx + (z - line.sz) * dz) / d2, 0, 1);
    const px = line.sx + dx * t, pz = line.sz + dz * t;
    return { t, x: px, z: pz, distanceM: Math.hypot(x - px, z - pz) };
  }
  function nearestWallForOpening(id, maxDistanceM = OPENING_REATTACH_TOLERANCE_M) {
    const item = itemFor(id), element = elementFor(id);
    if (!item || !element || !isOpening(element, item)) return null;
    const point = worldOf(item), dims = dimensions(item);
    const width = Math.max(0, Number(element.widthM || dims?.width || 0));
    let best = null;
    (plan()?.elements || []).forEach((wall) => {
      const wallItem = itemFor(wall.id);
      if (!wallItem || !isWall(wall, wallItem)) return;
      const line = lineFor(wall, wallItem);
      if (!line || line.length < width + 0.04) return;
      const projection = closestPointOnLine(point.x, point.z, line);
      if (!projection || projection.distanceM > maxDistanceM) return;
      if (!best || projection.distanceM < best.distanceM - 1e-9
          || (Math.abs(projection.distanceM - best.distanceM) <= 1e-9 && String(wall.id) < best.wallId)) {
        best = { wallId: String(wall.id), distanceM: projection.distanceM };
      }
    });
    return best;
  }
  function reattachOpening(id, maxDistanceM = OPENING_REATTACH_TOLERANCE_M) {
    const element = elementFor(id);
    if (!element) return false;
    const candidate = nearestWallForOpening(id, maxDistanceM);
    if (!candidate) return false;
    const changedParent = String(element.parentId || "") !== candidate.wallId;
    element.parentId = candidate.wallId;
    const snapped = snapOpening(id);
    return changedParent || snapped;
  }
  function nearestWallEndpoint(x, z, excludeWallId, toleranceM = ENDPOINT_SNAP_TOLERANCE_M) {
    let best = null;
    (plan()?.elements || []).forEach((entry) => {
      if (String(entry.id) === String(excludeWallId)) return;
      const wallItem = itemFor(entry.id);
      if (!wallItem || !isWall(entry, wallItem)) return;
      const line = lineFor(entry, wallItem);
      if (!line) return;
      [["start", line.sx, line.sz], ["end", line.ex, line.ez]].forEach(([endpoint, px, pz]) => {
        const distanceM = Math.hypot(x - px, z - pz);
        if (distanceM > toleranceM) return;
        if (!best || distanceM < best.distanceM - 1e-9
            || (Math.abs(distanceM - best.distanceM) <= 1e-9 && `${entry.id}:${endpoint}` < `${best.wallId}:${best.endpoint}`)) {
          best = { wallId: String(entry.id), endpoint, x: px, z: pz, distanceM };
        }
      });
    });
    return best;
  }
  function updateWallItemFromLine(item, element, oldLine, nextLine) {
    const centerX = (nextLine.sx + nextLine.ex) / 2, centerZ = (nextLine.sz + nextLine.ez) / 2;
    setWorld(item, centerX, centerZ);
    item.facing = ((nextLine.rotation % 360) + 360) % 360;
    const dims = dimensions(item) || { height: Number(element.heightM || 2.8) };
    item.referenceDimensionsM = {
      width: nextLine.length,
      height: Math.max(0.02, Number(dims.height || element.heightM || 2.8)),
      depth: nextLine.thickness,
    };
    if (item.physicalDimensionsM) item.physicalDimensionsM = { ...item.referenceDimensionsM };
    writeLine(element, nextLine);
    moveChildren(item.id, oldLine, nextLine);
  }
  function setWallEndpoint(itemId, endpoint, worldX, worldZ, options = {}) {
    const item = itemFor(itemId), element = elementFor(itemId);
    if (!item || !element || !isWall(element, item) || !["start", "end"].includes(endpoint)) return false;
    if (locked(item)) {
      if (options.notify !== false && typeof notifyEditLocked === "function") notifyEditLocked(item.name || "벽");
      return false;
    }
    const oldLine = lineFor(element, item);
    if (!oldLine) return false;
    let x = Number(worldX), z = Number(worldZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    runtime.lastEndpointSnap = null;
    if (options.snap !== false) {
      const target = nearestWallEndpoint(x, z, itemId, Number(options.toleranceM || ENDPOINT_SNAP_TOLERANCE_M));
      if (target) {
        x = target.x; z = target.z; runtime.lastEndpointSnap = target;
      }
    }
    const sx = endpoint === "start" ? x : oldLine.sx;
    const sz = endpoint === "start" ? z : oldLine.sz;
    const ex = endpoint === "end" ? x : oldLine.ex;
    const ez = endpoint === "end" ? z : oldLine.ez;
    const length = Math.hypot(ex - sx, ez - sz);
    if (length < 0.1) return false;
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    const rotation = Math.atan2(ez - sz, ex - sx) * 180 / Math.PI;
    const nextLine = { sx, sz, ex, ez, length, thickness: oldLine.thickness, rotation };
    updateWallItemFromLine(item, element, oldLine, nextLine);
    refreshRoomZones();
    if (options.commit !== false) {
      const preserved = [item.id, ...children(item.id).map((entry) => entry.item.id)];
      if (typeof commit === "function") commit({ preserveSourceIds: preserved });
      if (typeof syncUi === "function") syncUi(false);
      if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    return true;
  }
'''
source = source.replace(snap_anchor, helpers + snap_anchor, 1)

old_opening_drag = '          if (item && element && isOpening(element, item)) snapOpening(id);'
new_opening_drag = '          if (item && element && isOpening(element, item)) reattachOpening(id, OPENING_REATTACH_TOLERANCE_M);'
assert old_opening_drag in source
source = source.replace(old_opening_drag, new_opening_drag, 1)

fields_anchor = '  function installFields() {'
assert fields_anchor in source
endpoint_ui = r'''  function endpointLayer() { return document.getElementById("architecturalEndpointHandles"); }
  function worldToCanvasPoint(x, z) {
    if (typeof threeView === "undefined" || !threeView?.camera || !root.THREE) return null;
    const canvas = document.getElementById("threeCanvas") || threeView.canvas;
    const wrap = document.getElementById("threeWrap") || threeView.wrap;
    if (!canvas || !wrap || typeof wrap.getBoundingClientRect !== "function") return null;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const point = new root.THREE.Vector3(Number(x), 0.08, Number(z)).project(threeView.camera);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z < -1.2 || point.z > 1.2) return null;
    return { left: (point.x + 1) * 0.5 * rect.width, top: (1 - point.y) * 0.5 * rect.height };
  }
  function syncEndpointHandles() {
    const layer = endpointLayer();
    if (!layer) return;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    const show = root.FrisFrameBirdseye25D?.mode === "2.5d" && item && element && isWall(element, item);
    layer.hidden = !show;
    layer.style.display = show ? "block" : "none";
    if (!show) return;
    const line = lineFor(element, item);
    [["start", line.sx, line.sz], ["end", line.ex, line.ez]].forEach(([endpoint, x, z]) => {
      const button = layer.querySelector?.(`button[data-wall-endpoint="${endpoint}"]`);
      const screen = worldToCanvasPoint(x, z);
      if (!button || !screen) {
        if (button) button.hidden = true;
        return;
      }
      button.hidden = false;
      button.style.left = `${screen.left}px`;
      button.style.top = `${screen.top}px`;
      const snap = runtime.lastEndpointSnap;
      const activeSnap = runtime.endpointDrag?.endpoint === endpoint && snap;
      button.dataset.snapTarget = activeSnap ? `${snap.wallId}:${snap.endpoint}` : "";
      button.title = activeSnap ? `코너 스냅 · ${snap.wallId}` : `${endpoint === "start" ? "시작" : "끝"}점 드래그`;
    });
  }
  function pointerWorldPoint(event) {
    if (typeof threeView === "undefined" || !threeView?.camera || !root.THREE) return null;
    const canvas = document.getElementById("threeCanvas") || threeView.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new root.THREE.Vector2(
      ((Number(event.clientX) - rect.left) / rect.width) * 2 - 1,
      -(((Number(event.clientY) - rect.top) / rect.height) * 2 - 1),
    );
    const raycaster = new root.THREE.Raycaster();
    raycaster.setFromCamera(mouse, threeView.camera);
    const target = new root.THREE.Vector3();
    const plane = new root.THREE.Plane(new root.THREE.Vector3(0, 1, 0), 0);
    return raycaster.ray.intersectPlane(plane, target) ? { x: target.x, z: target.z } : null;
  }
  function beginEndpointDrag(event) {
    const button = event.currentTarget || event.target;
    const endpoint = button?.dataset?.wallEndpoint;
    const item = selectedItem(), element = item ? elementFor(item.id) : null;
    if (!item || !element || !isWall(element, item) || !["start", "end"].includes(endpoint) || locked(item)) return;
    if (typeof materializeEvaluatedViewForEditing === "function") materializeEvaluatedViewForEditing(item.id);
    runtime.endpointDrag = { pointerId: event.pointerId, itemId: item.id, endpoint, changed: false };
    runtime.lastEndpointSnap = null;
    button.setPointerCapture?.(event.pointerId);
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function moveEndpointDrag(event) {
    const drag = runtime.endpointDrag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    const point = pointerWorldPoint(event);
    if (!point) return;
    drag.changed = setWallEndpoint(drag.itemId, drag.endpoint, point.x, point.z, { snap: true, commit: false, notify: false }) || drag.changed;
    if (drag.changed && typeof renderThreeView === "function") {
      renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    syncEndpointHandles(); syncFields();
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function finishEndpointDrag(event) {
    const drag = runtime.endpointDrag;
    if (!drag || (drag.pointerId != null && event.pointerId != null && drag.pointerId !== event.pointerId)) return;
    runtime.endpointDrag = null;
    if (drag.changed) {
      const preserved = [drag.itemId, ...children(drag.itemId).map((entry) => entry.item.id)];
      if (typeof commit === "function") commit({ preserveSourceIds: preserved });
      if (typeof syncUi === "function") syncUi(false);
      if (typeof renderThreeView === "function") renderThreeView(typeof currentInteractionFrame === "function" ? currentInteractionFrame() : currentState(), true);
    }
    runtime.lastEndpointSnap = null;
    syncEndpointHandles(); syncFields();
    event.preventDefault?.(); event.stopPropagation?.();
  }
  function installEndpointHandles() {
    const wrap = document.getElementById("threeWrap");
    if (!wrap || endpointLayer()) return true;
    const layer = document.createElement("div");
    layer.id = "architecturalEndpointHandles";
    layer.hidden = true;
    layer.style.cssText = "position:absolute;inset:0;z-index:55;pointer-events:none";
    ["start", "end"].forEach((endpoint) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.wallEndpoint = endpoint;
      button.setAttribute?.("aria-label", endpoint === "start" ? "벽 시작점" : "벽 끝점");
      button.style.cssText = "position:absolute;width:18px;height:18px;padding:0;border:2px solid #dff7ff;border-radius:50%;background:#267fa5;box-shadow:0 0 0 3px rgba(20,42,52,.62);transform:translate(-50%,-50%);cursor:grab;pointer-events:auto";
      button.addEventListener("pointerdown", beginEndpointDrag);
      layer.appendChild(button);
    });
    wrap.appendChild(layer);
    document.addEventListener("pointermove", moveEndpointDrag, true);
    document.addEventListener("pointerup", finishEndpointDrag, true);
    document.addEventListener("pointercancel", finishEndpointDrag, true);
    return true;
  }
'''
source = source.replace(fields_anchor, endpoint_ui + fields_anchor, 1)

hook_anchor = '''    if (typeof syncUi === "function") {
      const originalSync = syncUi;
      syncUi = function architecturalSync(...args) { const result = originalSync(...args); reconcile(); syncFields(); return result; };
    }
  }'''
hook_new = '''    if (typeof syncUi === "function") {
      const originalSync = syncUi;
      syncUi = function architecturalSync(...args) { const result = originalSync(...args); reconcile(); syncFields(); syncEndpointHandles(); return result; };
    }
    if (typeof renderThreeView === "function") {
      const originalRender = renderThreeView;
      renderThreeView = function architecturalRender(...args) {
        const result = originalRender(...args);
        requestAnimationFrame?.(syncEndpointHandles);
        return result;
      };
    }
  }'''
assert hook_anchor in source
source = source.replace(hook_anchor, hook_new, 1)

install_anchor = '    if (!installFields()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    installHooks(); refreshRoomZones(); syncFields();'
install_new = '    if (!installFields()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    if (!installEndpointHandles()) { if (runtime.attempts < 80) setTimeout(install, 50); return; }\n    installHooks(); refreshRoomZones(); syncFields(); syncEndpointHandles();'
assert install_anchor in source
source = source.replace(install_anchor, install_new, 1)

api_anchor = '''      reconcile,
      snapOpeningToParent: snapOpening,
      setWallMetrics,'''
api_new = '''      reconcile,
      snapOpeningToParent: snapOpening,
      reattachOpeningToNearestWall: reattachOpening,
      setWallEndpoint,
      get lastEndpointSnap() { return runtime.lastEndpointSnap; },
      setWallMetrics,'''
assert api_anchor in source
source = source.replace(api_anchor, api_new, 1)

# Keep handle positions fresh during native 2.5D dragging.
source = source.replace('        syncFields();\n        return result;\n      };', '        syncFields(); syncEndpointHandles();\n        return result;\n      };', 1)

source_path.write_text(source, encoding="utf-8")

quality_anchor = '        "tests/architectural-cad-runtime.test.cjs",\n'
assert quality_anchor in quality
quality = quality.replace(quality_anchor, quality_anchor + '        "tests/architectural-cad-v2-runtime.test.cjs",\n', 1)
quality_path.write_text(quality, encoding="utf-8")
