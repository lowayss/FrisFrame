const assert = require("node:assert/strict");

const {
  classifyRecovery,
  createRecoveryRecord,
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

const legacyRecord = {
  ...record,
  version: 1,
  fingerprint: JSON.stringify(changedDocument.project),
};
const migratedLegacyRecord = parseRecoveryRecord(JSON.stringify(legacyRecord));
assert.equal(migratedLegacyRecord.version, 2);
assert.equal(migratedLegacyRecord.fingerprint, projectFingerprint(changedDocument));

console.log("project-recovery-core: recovery validation and conflict classification passed");
