from pathlib import Path

path = Path("multi-camera-core.js")
source = path.read_text(encoding="utf-8")
old = '    if (!controls || !wrap) return false;'
new = '    if (!controls || !wrap) return true;'
if old not in source:
    raise SystemExit("compatibility anchor not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
