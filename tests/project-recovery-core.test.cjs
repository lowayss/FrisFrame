const assert = require("node:assert/strict");

const {
  classifyRecovery,
  createRecoveryRecord,
  normalizeRevision,
  projectFingerprint,
  parseRecoveryRecord,
} = require("../project-recovery-core.js");

const serverDocument = { app: "FrisFrame", project: { title: "원본", scenes: [] } };
const changedDocument = { app: "FrisFrame", project: { title: "복구본", scenes: [] } };
const record = createRecoveryRecord({
  projectId: "project-1",
  revision: 3,
  document: changedDocument,
  savedAt: "2026-07-13T00:00:00.000Z",
});

assert.deepEqual(parseRecoveryRecord(JSON.stringify(record)), record);
assert.ok(projectFingerprint(changedDocument).length < 40, "fingerprint must not duplicate the project document");
assert.equal(parseRecoveryRecord("not-json"), null);
assert.equal(parseRecoveryRecord(JSON.stringify({ ...record, fingerprint: "tampered" })), null);
assert.equal(classifyRecovery(record, {
  projectId: "project-1",
  revision: 3,
  document: changedDocument,
}), "same");
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

const legacyRecord = {
  ...record,
  version: 1,
  fingerprint: JSON.stringify(changedDocument.project),
};
const migratedLegacyRecord = parseRecoveryRecord(JSON.stringify(legacyRecord));
assert.equal(migratedLegacyRecord.version, 2);
assert.equal(migratedLegacyRecord.fingerprint, projectFingerprint(changedDocument));

console.log("project-recovery-core: immutable snapshots, revision validation, large payloads, and conflict classification passed");
