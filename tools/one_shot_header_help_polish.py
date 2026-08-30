#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "electron" / "history-safety-ux.js"
TEST = ROOT / "tests" / "history-safety-contract.test.cjs"

source = SOURCE.read_text(encoding="utf-8")

css_anchor = '''    .app.is-storyboard .frisframe-quick-lock { display: none !important; }\n\n    .frisframe-drag-cancel-hint {'''
css_replacement = '''    .app.is-storyboard .frisframe-quick-lock { display: none !important; }\n\n    @media (max-width: 1320px) {\n      .frisframe-save-detail { display: none; }\n      .frisframe-quick-lock {\n        width: 29px;\n        min-width: 29px;\n        padding: 0;\n        margin-left: 2px;\n        justify-content: center;\n        gap: 0;\n      }\n      .frisframe-quick-lock .frisframe-quick-lock-label,\n      .frisframe-quick-lock kbd { display: none; }\n    }\n\n    .frisframe-drag-cancel-hint {'''
if css_anchor not in source:
    raise SystemExit("responsive quick-lock CSS anchor did not match current source")
source = source.replace(css_anchor, css_replacement, 1)

help_anchor = '''  let dirtyAt = 0;\n  let lastSavedAt = 0;'''
help_replacement = '''  const threeShortcuts = document.querySelector(".three-shortcuts");\n  if (threeShortcuts && threeShortcuts.dataset.frisframeSafetyHelp !== "1") {\n    threeShortcuts.dataset.frisframeSafetyHelp = "1";\n    const cancelHelp = document.createElement("span");\n    cancelHelp.innerHTML = '<kbd>Esc</kbd> 드래그 취소';\n    const lockHelp = document.createElement("span");\n    lockHelp.innerHTML = '<kbd>L</kbd> 선택 대상 잠금';\n    threeShortcuts.append(cancelHelp, lockHelp);\n  }\n\n  let dirtyAt = 0;\n  let lastSavedAt = 0;'''
if help_anchor not in source:
    raise SystemExit("3D safety help anchor did not match current source")
source = source.replace(help_anchor, help_replacement, 1)
SOURCE.write_text(source, encoding="utf-8")

test = TEST.read_text(encoding="utf-8")
console_anchor = 'console.log("history-safety-contract: undo/redo, autosave, lock, and drag cancellation contracts passed");\n'
assertions = '''assert.match(source, /@media \\(max-width: 1320px\\)[^]*frisframe-quick-lock-label[^]*display: none/,\n  "narrow desktop headers must collapse the contextual lock to an icon-only control");\nassert.match(source, /frisframe-save-detail \\{ display: none; \\}/,\n  "narrow desktop headers must hide secondary save-detail text before crowding the toolbar");\nassert.match(source, /<kbd>Esc<\\/kbd> 드래그 취소/,\n  "3D help must expose direct-edit cancellation");\nassert.match(source, /<kbd>L<\\/kbd> 선택 대상 잠금/,\n  "3D help must expose contextual quick lock");\n\nconsole.log("history-safety-contract: undo/redo, autosave, responsive lock, help, and drag cancellation contracts passed");\n'''
if console_anchor not in test:
    raise SystemExit("history safety test anchor did not match current source")
test = test.replace(console_anchor, assertions, 1)
TEST.write_text(test, encoding="utf-8")

print("responsive header and 3D safety help polish prepared")
