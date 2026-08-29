const assert = require("node:assert/strict");

const {
  buildReferenceBatchManifest,
  collectReferenceBatchCuts,
  exportReferenceVideoBatch,
  safeFileSlug,
} = require("../previs-runtime-core.js");

assert.equal(safeFileSlug(' Scene 01 / Close:Up? '), "Scene-01-Close-Up");
assert.equal(safeFileSlug(""), "cut");

const project = {
  title: "Reference Film",
  scenes: [
    {
      id: "scene-1",
      number: 1,
      heading: "INT. ROOM",
      cuts: [
        {
          id: "cut-1",
          number: 1,
          title: "Push In",
          status: "approved",
          blocking: { camera: { focal: 50 }, motion: { duration: 2.5, fps: 24, keyframes: [] } },
        },
        {
          id: "cut-zero",
          number: 2,
          title: "Invalid",
          blocking: { motion: { duration: 0, fps: 24, keyframes: [] } },
        },
      ],
    },
    {
      id: "scene-2",
      number: 2,
      heading: "EXT. STREET",
      cuts: [
        {
          id: "cut-2",
          number: 1,
          title: "Follow / Exit",
          status: "review",
          blocking: { camera: { focal: 35 }, motion: { duration: 3, fps: 30, keyframes: [] } },
        },
      ],
    },
  ],
};

const entries = collectReferenceBatchCuts(project);
assert.equal(entries.length, 2);
assert.equal(entries[0].filename, "S01_C01_Push-In_reference.mp4");
assert.equal(entries[1].filename, "S02_C01_Follow-Exit_reference.mp4");
assert.equal(entries[0].fps, 24);
assert.equal(entries[1].fps, 30);

const manifest = buildReferenceBatchManifest(project, entries);
assert.equal(manifest.type, "seedance-reference-video-batch");
assert.equal(manifest.projectTitle, project.title);
assert.equal(manifest.cuts.length, 2);
assert.equal(manifest.cuts[0].file, "videos/S01_C01_Push-In_reference.mp4");
assert.equal(manifest.policy.actorSecondaryMotion, "authored-only");

const encodedCuts = [];
const zipEntries = [];
const finalExports = [];
const notices = [];
let confirmCount = 0;

const fakeTarget = {
  managedProjectDocument() { return { project }; },
  async exportVideoForDocument(documentState, options) {
    encodedCuts.push({ documentState, options });
    this.presentExport(
      new Blob([`video:${options.filename}`], { type: "video/mp4" }),
      options.filename,
      options.exportLabel,
      { type: "video" },
    );
  },
  async createZip(files) {
    zipEntries.push(...files);
    return new Blob(["zip"], { type: "application/zip" });
  },
  presentExport(data, filename, label, preview) {
    finalExports.push({ data, filename, label, preview });
  },
  presentExportError(message) { throw new Error(message); },
  confirm(message) {
    confirmCount += 1;
    assert.ok(message.includes("2개 컷"));
    return true;
  },
  notifyApp(message) { notices.push(message); },
};

const originalPresentExport = fakeTarget.presentExport;
const originalPresentExportError = fakeTarget.presentExportError;

(async () => {
  const result = await exportReferenceVideoBatch(fakeTarget);
  assert.equal(result.cancelled, false);
  assert.equal(result.entries.length, 2);
  assert.equal(confirmCount, 1);
  assert.equal(encodedCuts.length, 2);
  assert.deepEqual(encodedCuts.map((entry) => entry.options.filename), entries.map((entry) => entry.filename));
  assert.equal(zipEntries.filter((entry) => entry.path.startsWith("videos/")).length, 2);
  assert.ok(zipEntries.some((entry) => entry.path === "manifest.json"));
  assert.ok(zipEntries.some((entry) => entry.path === "README.md"));
  assert.equal(finalExports.length, 1, "individual MP4 preview dialogs must be captured instead of shown one by one");
  assert.equal(finalExports[0].filename, "Reference-Film_seedance_reference_videos.zip");
  assert.equal(finalExports[0].label, "Seedance 레퍼런스 MP4 ZIP");
  assert.equal(finalExports[0].preview.type, "text");
  assert.equal(fakeTarget.presentExport, originalPresentExport, "presentExport must be restored after batch collection");
  assert.equal(fakeTarget.presentExportError, originalPresentExportError, "presentExportError must be restored after batch collection");
  assert.ok(notices.at(-1).includes("2개"));

  const cancelledTarget = {
    ...fakeTarget,
    confirm() { return false; },
  };
  const cancelled = await exportReferenceVideoBatch(cancelledTarget);
  assert.equal(cancelled.cancelled, true);

  console.log("reference-batch-export: sequential MP4 collection and ZIP manifest passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
