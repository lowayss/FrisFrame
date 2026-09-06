from pathlib import Path
p=Path('tests/phone-motion-server.test.cjs')
s=p.read_text(encoding='utf-8')
old='assert.match(html,/ack\\.ack===cmd\\.id/);'
new='assert.match(html,/body\\.ack===cmd\\.id/);'
if s.count(old)!=1:
    raise SystemExit(f'expected stale ack assertion once, got {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('stale applied-ack expectation fixed')
