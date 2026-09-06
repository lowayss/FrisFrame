from pathlib import Path

path = Path("reference_master_pipeline_mcp.py")
source = path.read_text(encoding="utf-8")
old = '    raw_master_plan = _compile_raw_master_plan(prepared, normalized_interpretation)\n'
new = '    raw_master_plan = _compile_raw_master_plan(raw, normalized_interpretation)\n'
if old not in source:
    raise SystemExit("missing prepared master-plan compile anchor")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
