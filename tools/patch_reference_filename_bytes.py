from pathlib import Path
import re

motion = Path("motion-core.js")
text = motion.read_text(encoding="utf-8")

replacement = r'''  function utf8CodePointByteLength(character) {
    const codePoint = String(character || "").codePointAt(0);
    if (!Number.isFinite(codePoint)) return 0;
    if (codePoint <= 0x7f) return 1;
    if (codePoint <= 0x7ff) return 2;
    if (codePoint <= 0xffff) return 3;
    return 4;
  }

  function truncateFilenameText(value, maxCharacters = 80, maxBytes = 160) {
    const characterLimit = Math.max(0, Math.floor(finiteNumber(maxCharacters, 80)));
    const byteLimit = Math.max(0, Math.floor(finiteNumber(maxBytes, 160)));
    let characters = 0;
    let bytes = 0;
    let output = "";
    for (const character of String(value || "")) {
      if (characters >= characterLimit) break;
      const size = utf8CodePointByteLength(character);
      if (bytes + size > byteLimit) break;
      output += character;
      characters += 1;
      bytes += size;
    }
    return output;
  }

  function safeFileSlug(value, fallback = "cut") {
    const clean = (input) => {
      const sanitized = String(input || "")
        .normalize("NFKC")
        .trim()
        .replace(/[\u0000-\u001f\u007f]+/g, "-")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[.-]+|[.-]+$/g, "");
      return truncateFilenameText(sanitized, 80, 160);
    };
    const normalized = clean(value) || clean(fallback) || "cut";
    return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(normalized)
      ? `_${normalized}`
      : normalized;
  }

'''
pattern = re.compile(
    r'  function safeFileSlug\(value, fallback = \\"cut\\"\) \{.*?(?=  function collectReferenceBatchCuts\(project = \{\}\) \{)',
    re.S,
)
text, count = pattern.subn(lambda _match: replacement, text, count=1)
if count != 1:
    raise SystemExit(f"safeFileSlug patch count: {count}")
motion.write_text(text, encoding="utf-8")

test = Path("tests/reference-batch-export.test.cjs")
test_text = test.read_text(encoding="utf-8")
marker = 'assert.equal(safeFileSlug("bad\\u0000name"), "bad-name");\n'
addition = '''assert.equal(safeFileSlug("bad\\u0000name"), "bad-name");
const longAsciiSlug = safeFileSlug("a".repeat(100));
assert.equal(longAsciiSlug, "a".repeat(80), "existing ASCII 80-character cap must remain unchanged");
const longKoreanSlug = safeFileSlug("가".repeat(80));
assert.equal(longKoreanSlug, "가".repeat(53));
assert.ok(Buffer.byteLength(longKoreanSlug, "utf8") <= 160);
const longEmojiSlug = safeFileSlug("😀".repeat(80));
assert.equal(longEmojiSlug, "😀".repeat(40));
assert.equal(Buffer.byteLength(longEmojiSlug, "utf8"), 160);

const longUnicodeFilenameProject = {
  scenes: [{
    number: 1,
    cuts: [{
      id: "unicode-long",
      number: 1,
      title: "가".repeat(80),
      blocking: { motion: { duration: 1, fps: 24, keyframes: [] } },
    }],
  }],
};
const [longUnicodeFilenameEntry] = collectReferenceBatchCuts(longUnicodeFilenameProject);
assert.ok(Buffer.byteLength(longUnicodeFilenameEntry.filename, "utf8") < 255);
'''
if "longUnicodeFilenameProject" not in test_text:
    if marker not in test_text:
        raise SystemExit("filename test insertion marker not found")
    test_text = test_text.replace(marker, addition, 1)
test.write_text(test_text, encoding="utf-8")
