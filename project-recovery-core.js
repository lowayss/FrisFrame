(function initProjectRecoveryCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameProjectRecoveryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const RECOVERY_VERSION = 2;

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

  function projectFingerprint(document) {
    return hashString(JSON.stringify(document?.project ?? null));
  }

  function createRecoveryRecord({ projectId, revision, document, savedAt = new Date().toISOString() }) {
    if (!projectId || !document?.project) throw new Error("복구 기록에 프로젝트 정보가 없습니다.");
    return {
      version: RECOVERY_VERSION,
      projectId: String(projectId),
      revision: Math.max(0, Number(revision || 0)),
      savedAt: String(savedAt),
      fingerprint: projectFingerprint(document),
      document,
    };
  }

  function parseRecoveryRecord(raw) {
    try {
      const record = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!record || ![1, RECOVERY_VERSION].includes(record.version) || !record.projectId || !record.document?.project) return null;
      const currentFingerprint = projectFingerprint(record.document);
      const validFingerprint = record.version === 1
        ? record.fingerprint === JSON.stringify(record.document.project)
        : record.fingerprint === currentFingerprint;
      if (!validFingerprint) return null;
      return record.version === RECOVERY_VERSION ? record : {
        ...record,
        version: RECOVERY_VERSION,
        fingerprint: currentFingerprint,
      };
    } catch {
      return null;
    }
  }

  function classifyRecovery(record, { projectId, revision, document }) {
    if (!record || record.projectId !== String(projectId || "")) return "none";
    if (record.fingerprint === projectFingerprint(document)) return "same";
    if (Number(record.revision) === Number(revision || 0)) return "restore";
    return "conflict";
  }

  return {
    RECOVERY_VERSION,
    classifyRecovery,
    createRecoveryRecord,
    hashString,
    parseRecoveryRecord,
    projectFingerprint,
  };
});
