const assert = require("node:assert/strict");

const {
  RECOVERY_VERSION,
  classifyRecovery,
  createRecoveryRecord,
  documentFingerprint,
  normalizeRevision,
  projectFingerprint,
  parseRecoveryRecord,
  stableStringify,
} = require("../project-recovery-core.js");

const serverDocument = { app: "FrisFrame", project: { title: "원본", scenes: [] } };
const changedDocument = { app: "FrisFrame", project: { title: "복구본", scenes: [] } };
const record = createRecoveryRecord({
  projectId: "project-1",
  revision: 3,
  document: changedDocument,
  savedAt: "2026-07-13T00:00:00.000Z",
});

assert.equal(RECOVERY_VERSION, 3);
assert.deepEqual(parseRecoveryRecord(JSON.stringify(record)), record);
assert.ok(projectFingerprint(changedDocument).length < 40, "legacy project fingerprint must remain compact");
assert.ok(documentFingerprint(changedDocument).length < 40, "full document fingerprint must remain compact");
assert.equal(parseRecoveryRecord("not-json"), null);
assert.equal(parseRecoveryRecord(JSON.stringify({ ...record, fingerprint: "tampered" })), null);
assert.equal(parseRecoveryRecord(JSON.stringify({
  ...record,
  document: { ...record.document, app: "Tampered" },
})), null, "top-level recovery metadata must be covered by the v3 fingerprint");
assert.equal(classifyRecovery(record, {
  projectId: "project-1",
  revision: 3,
  document: changedDocument,
}), "same");
assert.equal(classifyRecovery(record, {
  projectId: "project-1",
  revision: 3,
  document: { project: { scenes: [], title: "복구본" }, app: "FrisFrame" },
}), "same", "object key order must not create a false recovery conflict");
assert.equal(classifyRecovery(record, {
  projectId: "project-1",
  revision: 3,
  document: serverDocument,
}), "restore");
assert.equal(classifyRecovery(record, {
  projectId: "project-1",
  revision: 4,
  document: serverDocument,
}), "conflict");
assert.equal(classifyRecovery(record, {
  projectId: "project-2",
  revision: 3,
  document: serverDocument,
}), "none");

assert.equal(
  stableStringify({ z: 1, nested: { b: 2, a: 1 }, list: [{ y: 2, x: 1 }] }),
  stableStringify({ list: [{ x: 1, y: 2 }], nested: { a: 1, b: 2 }, z: 1 }),
  "canonical JSON must ignore object insertion order while preserving JSON values",
);

// Recovery creation must capture an independent snapshot. Mutating the live
// editor document afterwards must not mutate or invalidate the recovery copy.
const mutableDocument = {
  app: "FrisFrame",
  project: {
    title: "스냅샷",
    scenes: [{ id: "scene-1", cuts: [{ id: "cut-1", duration: 2 }] }],
  },
};
const snapshotRecord = createRecoveryRecord({
  projectId: "snapshot-project",
  revision: 7,
  document: mutableDocument,
  savedAt: "2026-08-29T00:00:00.000Z",
});
const snapshotFingerprint = snapshotRecord.fingerprint;
mutableDocument.project.title = "라이브 문서 변경";
mutableDocument.project.scenes[0].cuts[0].duration = 9;
assert.equal(snapshotRecord.document.project.title, "스냅샷");
assert.equal(snapshotRecord.document.project.scenes[0].cuts[0].duration, 2);
assert.equal(snapshotRecord.fingerprint, snapshotFingerprint);
assert.deepEqual(parseRecoveryRecord(JSON.stringify(snapshotRecord)), snapshotRecord);

// Parsing an object value must also detach the returned recovery document from
// the caller-owned object so later mutations cannot change the parsed record.
const callerOwnedRecord = JSON.parse(JSON.stringify(snapshotRecord));
const detachedParsedRecord = parseRecoveryRecord(callerOwnedRecord);
callerOwnedRecord.document.project.title = "호출자 변경";
assert.equal(detachedParsedRecord.document.project.title, "스냅샷");

// Creation normalizes editor/runtime revision inputs to stable integers, while
// persisted malformed records are rejected rather than silently reinterpreted.
assert.equal(normalizeRevision(undefined), 0);
assert.equal(normalizeRevision(-5), 0);
assert.equal(normalizeRevision(4.9), 4);
assert.equal(normalizeRevision("12"), 12);
assert.equal(normalizeRevision(Number.NaN), 0);
assert.equal(normalizeRevision(Number.POSITIVE_INFINITY), 0);
assert.equal(createRecoveryRecord({ projectId: "revision", revision: Number.NaN, document: serverDocument }).revision, 0);
assert.equal(createRecoveryRecord({ projectId: "revision", revision: 8.8, document: serverDocument }).revision, 8);
assert.equal(parseRecoveryRecord({ ...record, revision: "3" }), null);
assert.equal(parseRecoveryRecord({ ...record, revision: 3.5 }), null);
assert.equal(parseRecoveryRecord({ ...record, revision: Number.NaN }), null);
assert.equal(parseRecoveryRecord({ ...record, revision: -1 }), null);

// A realistically larger storyboard should round-trip without sharing live
// references or changing its fingerprint.
const largeDocument = {
  app: "FrisFrame",
  schemaVersion: 11,
  project: {
    title: "대형 프로젝트",
    scenes: Array.from({ length: 40 }, (_, sceneIndex) => ({
      id: `scene-${sceneIndex}`,
      cuts: Array.from({ length: 20 }, (_, cutIndex) => ({
        id: `cut-${sceneIndex}-${cutIndex}`,
        duration: 15,
        motion: {
          fps: 24,
          keyframes: Array.from({ length: 12 }, (_, keyIndex) => ({
            id: `key-${keyIndex}`,
            time: keyIndex / 2,
            sourceId: keyIndex % 2 === 0 ? "camera" : "actor-1",
          })),
        },
      })),
    })),
  },
};
const largeRecord = createRecoveryRecord({ projectId: "large", revision: 91, document: largeDocument });
const largeRoundTrip = parseRecoveryRecord(JSON.stringify(largeRecord));
assert.equal(largeRoundTrip.revision, 91);
assert.equal(largeRoundTrip.fingerprint, largeRecord.fingerprint);
assert.equal(largeRoundTrip.document.project.scenes.length, 40);
assert.equal(largeRoundTrip.document.project.scenes[39].cuts.length, 20);
assert.notEqual(largeRoundTrip.document, largeDocument);

const legacyV2Record = {
  ...record,
  version: 2,
  fingerprint: projectFingerprint(changedDocument),
};
const migratedV2Record = parseRecoveryRecord(JSON.stringify(legacyV2Record));
assert.equal(migratedV2Record.version, RECOVERY_VERSION);
assert.equal(migratedV2Record.fingerprint, documentFingerprint(changedDocument));

const legacyV1Record = {
  ...record,
  version: 1,
  fingerprint: JSON.stringify(changedDocument.project),
};
const migratedV1Record = parseRecoveryRecord(JSON.stringify(legacyV1Record));
assert.equal(migratedV1Record.version, RECOVERY_VERSION);
assert.equal(migratedV1Record.fingerprint, documentFingerprint(changedDocument));

console.log("project-recovery-core: canonical full-document integrity, immutable snapshots, revision validation, large payloads, and legacy migration passed");