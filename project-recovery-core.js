(function initProjectRecoveryCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameProjectRecoveryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const RECOVERY_VERSION = 3;

  function hashString(value) {
    const text = String(value);
    let first = 0xdeadbeef ^ text.length;
    let second = 0x41c6ce57 ^ text.length;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 2654435761);
      second = Math.imul(second ^ code, 1597334677);
    }
    first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
    second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
    return `${(second >>> 0).toString(16).padStart(8, "0")}${(first >>> 0).toString(16).padStart(8, "0")}:${text.length}`;
  }

  function normalizeRevision(value) {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.trunc(numeric));
  }

  function isValidRevision(value) {
    return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
  }

  function snapshotDocument(document) {
    if (!document?.project) throw new Error("복구 기록에 프로젝트 정보가 없습니다.");
    const serialized = JSON.stringify(document);
    const snapshot = JSON.parse(serialized);
    if (!snapshot?.project) throw new Error("복구 기록에 프로젝트 정보가 없습니다.");
    return snapshot;
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function projectFingerprint(document) {
    return hashString(JSON.stringify(document?.project ?? null));
  }

  function documentFingerprint(document) {
    return hashString(stableStringify(document ?? null));
  }

  function createRecoveryRecord({ projectId, revision, document, savedAt = new Date().toISOString() }) {
    if (!projectId || !document?.project) throw new Error("복구 기록에 프로젝트 정보가 없습니다.");
    const snapshot = snapshotDocument(document);
    return {
      version: RECOVERY_VERSION,
      projectId: String(projectId),
      revision: normalizeRevision(revision),
      savedAt: String(savedAt),
      fingerprint: documentFingerprint(snapshot),
      document: snapshot,
    };
  }

  function parseRecoveryRecord(raw) {
    try {
      const record = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!record || ![1, 2, RECOVERY_VERSION].includes(record.version) || !record.projectId || !record.document?.project) return null;
      if (!isValidRevision(record.revision)) return null;
      const snapshot = snapshotDocument(record.document);
      const currentDocumentFingerprint = documentFingerprint(snapshot);
      const validFingerprint = record.version === 1
        ? record.fingerprint === JSON.stringify(snapshot.project)
        : record.version === 2
          ? record.fingerprint === projectFingerprint(snapshot)
          : record.fingerprint === currentDocumentFingerprint;
      if (!validFingerprint) return null;
      return {
        ...record,
        version: RECOVERY_VERSION,
        revision: record.revision,
        fingerprint: currentDocumentFingerprint,
        document: snapshot,
      };
    } catch {
      return null;
    }
  }

  function classifyRecovery(record, { projectId, revision, document }) {
    if (!record || record.projectId !== String(projectId || "")) return "none";
    if (record.fingerprint === documentFingerprint(document)) return "same";
    if (record.revision === normalizeRevision(revision)) return "restore";
    return "conflict";
  }

  return {
    RECOVERY_VERSION,
    classifyRecovery,
    createRecoveryRecord,
    documentFingerprint,
    hashString,
    isValidRevision,
    normalizeRevision,
    parseRecoveryRecord,
    projectFingerprint,
    snapshotDocument,
    stableStringify,
  };
});