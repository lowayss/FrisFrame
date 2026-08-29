const assert = require("node:assert/strict");
const motion = require("../motion-core.js");
const workflow = require("../reference-workflow-core.js");
const {
  exportReferenceBatchSafely,
  partitionReferenceBatchByReadiness,
} = workflow;

assert.equal(partitionReferenceBatchByReadiness, motion.partitionReferenceBatchByReadiness,
  "workflow must reuse the motion-core READY/REVIEW/BLOCKED partitioner");

function readyBlocking() {
  return {
    camera: { x: 0.8, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" },
    items: [{ id: "actor-1", type: "actor", name: "A", x: 0.5, y: 0.5, facing: 0 }],
    motion: {
      duration: 5,
      fps: 24,
      exportRange: { start: 0, end: 5 },
      keyframes: [
        { id: "c0", source: "camera", time: 0, pose: { x: 0.8, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" } },
        { id: "c1", source: "camera", time: 2, pose: { x: 0.7, y: 0.5, height: 1.6, panDeg: 180, tiltDeg: -4, focal: 50, trackingTargetId: "actor-1" } },
      ],
    },
  };
}

const blockedBlocking = readyBlocking();
blockedBlocking.camera.trackingTargetId = "missing-actor";

const reviewBlocking = readyBlocking();
reviewBlocking.motion.duration = 35;
reviewBlocking.motion.exportRange = { start: 0, end: 35 };

const project = {
  title: "Safety Batch",
  scenes: [{
    id: "scene-1",
    number: 1,
    heading: "TEST",
    cuts: [
      { id: "cut-ready", number: 1, title: "Ready", blocking: readyBlocking() },
      { id: "cut-blocked", number: 2, title: "Blocked", blocking: blockedBlocking },
      { id: "cut-review", number: 3, title: "Review", blocking: reviewBlocking },
    ],
  }],
};

const partition = partitionReferenceBatchByReadiness(project);
assert.equal(partition.allowed.length, 2);
assert.equal(partition.blocked.length, 1);
assert.deepEqual(partition.allowed.map((entry) => entry.title), ["Ready", "Review"]);
assert.equal(partition.blocked[0].title, "Blocked");
assert.deepEqual(partition.filteredProject.scenes[0].cuts.map((cut) => cut.id), ["cut-ready", "cut-review"]);
assert.equal(partition.skippedBlocked[0].readiness.status, "blocked");
assert.ok(partition.skippedBlocked[0].readiness.issues.some((issue) => issue.code === "tracking-missing"));

const encoded = [];
let zippedFiles = [];
const finalExports = [];
const notices = [];
let confirmation = "";
const target = {
  managedProjectDocument() { return { app: "FrisFrame", schemaVersion: 11, project }; },
  async exportVideoForDocument(documentState, options) {
    encoded.push(options.filename);
    this.presentExport(
      new Blob([options.filename], { type: "video/mp4" }),
      options.filename,
      options.exportLabel,
      { type: "video" },
    );
  },
  async createZip(files) {
    zippedFiles = files;
    return new Blob(["zip"], { type: "application/zip" });
  },
  presentExport(data, filename, label, preview) {
    finalExports.push({ data, filename, label, preview });
  },
  presentExportError(message) { throw new Error(message); },
  confirm(message) { confirmation = message; return true; },
  notifyApp(message) { notices.push(message); },
};

const originalManagedProjectDocument = target.managedProjectDocument;
const originalCreateZip = target.createZip;

(async () => {
  const result = await exportReferenceBatchSafely(target);
  assert.equal(result.cancelled, false);
  assert.equal(result.skippedBlocked.length, 1);
  assert.equal(encoded.length, 2, "BLOCKED cut must never reach the existing MP4 encoder");
  assert.ok(encoded.some((name) => name.includes("Ready")));
  assert.ok(encoded.some((name) => name.includes("Review")));
  assert.equal(encoded.some((name) => name.includes("Blocked")), false);
  assert.ok(confirmation.includes("READY/REVIEW 2개"));
  assert.ok(confirmation.includes("BLOCKED 1개는 자동 제외"));

  const videoFiles = zippedFiles.filter((file) => file.path?.startsWith("videos/"));
  assert.equal(videoFiles.length, 2);
  const manifestFile = zippedFiles.find((file) => file.path === "manifest.json");
  const manifest = JSON.parse(manifestFile.content);
  assert.equal(manifest.batchPolicy.blockedCuts, "skipped-by-default");
  assert.equal(manifest.skippedBlocked.length, 1);
  assert.equal(manifest.skippedBlocked[0].cutId, "cut-blocked");
  assert.ok(zippedFiles.some((file) => file.path === "skipped_blocked.json"));
  assert.equal(finalExports.length, 1);
  assert.ok(notices.some((message) => message.includes("BLOCKED 1개 컷을 제외")));
  assert.equal(target.managedProjectDocument, originalManagedProjectDocument, "managed project reader must always be restored");
  assert.equal(target.createZip, originalCreateZip, "ZIP creator must always be restored");

  let cancelEncoded = 0;
  const cancelledTarget = {
    ...target,
    managedProjectDocument: originalManagedProjectDocument,
    createZip: originalCreateZip,
    async exportVideoForDocument() { cancelEncoded += 1; },
    confirm() { return false; },
  };
  const cancelled = await exportReferenceBatchSafely(cancelledTarget);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelEncoded, 0);

  const allBlockedProject = {
    title: "All Blocked",
    scenes: [{ id: "s", number: 1, cuts: [{ id: "b", number: 1, title: "Broken", blocking: blockedBlocking }] }],
  };
  const allBlockedTarget = {
    ...target,
    managedProjectDocument() { return { project: allBlockedProject }; },
  };
  await assert.rejects(
    () => exportReferenceBatchSafely(allBlockedTarget, { confirmBeforeStart: false }),
    /출력 가능한 컷이 없습니다/,
  );

  console.log("reference-batch-policy: runtime-owned policy excludes BLOCKED cuts before MP4 encoding");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
