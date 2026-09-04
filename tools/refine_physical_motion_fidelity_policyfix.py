from pathlib import Path

p = Path("electron/interaction-ux.js")
s = p.read_text(encoding="utf-8")
old = "// Preserve the places where a real handheld move starts, settles, sharply\n"
new = "// Preserve the places where a real operator move starts, settles, sharply\n"
if old not in s:
    raise SystemExit("stale authored-motion policy comment target")
p.write_text(s.replace(old, new, 1), encoding="utf-8")
print("Physical Camera authored-motion policy wording corrected")
