"""Build public release from an explicit allowlist. Never traverse local data."""
import hashlib, html, io, re, sys, zipfile
from pathlib import Path

root = Path(__file__).resolve().parent
output = root.parent / 'public'
name = 'xbtpulse-datum-collector-1.0.0.zip'
files = ['datum.py', 'configure.py', 'check.py', 'config.example.json', 'INSTALL.md', 'README.md', 'test_datum.py']
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        info = zipfile.ZipInfo(filename, date_time=(2026, 9, 13, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, (root/filename).read_text(encoding='utf-8').replace('\r\n','\n'))
data = buffer.getvalue()
checksum = hashlib.sha256(data).hexdigest()+'  '+name+'\n'

def inline(text):
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', html.escape(text))

parts = []
code = None
paragraph = []
def flush():
    if paragraph:
        parts.append('<p>'+inline(' '.join(paragraph))+'</p>')
        paragraph.clear()
for line in (root/'INSTALL.md').read_text(encoding='utf-8').splitlines():
    if line.startswith('```'):
        flush()
        if code is None: code = []
        else:
            parts.append('<pre>'+html.escape('\n'.join(code))+'</pre>')
            code = None
    elif code is not None: code.append(line)
    elif line.startswith('# '): continue
    elif line.startswith('## '):
        flush();parts.append('<h2>'+inline(line[3:])+'</h2>')
    elif not line: flush()
    elif line.startswith('- '):
        flush();parts.append('<p>• '+inline(line[2:])+'</p>')
    else: paragraph.append(line)
flush()
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install the DATUM collector · XBT Pulse</title><link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg"></head><body><header class="topbar"><a class="brand" href="/">XBT PULSE</a><a href="/contribute">Operator registration →</a></header><main class="contribute-main"><p class="eyebrow">OPERATOR-INSTALLED TELEMETRY</p><h1>Run your own collector.</h1><p>No SSH access to your server is needed by XBT Pulse. You install and control the software.</p><p><a class="primary-button" href="/downloads/'''+name+'''" download>Download DATUM collector v1.0.0</a></p><p><a href="/downloads/SHA256SUMS.txt">SHA-256 checksum</a> · <a href="/contribute">Register your pool</a></p><article class="panel intake-panel">'''+''.join(parts)+'''</article><footer><a href="/contribute">Return to contribution page →</a></footer></main></body></html>'''
artifacts = {output/'downloads'/name:data, output/'downloads'/'SHA256SUMS.txt':checksum.encode(), output/'collector.html':page.encode()}
for path, content in artifacts.items():
    if '--check' in sys.argv:
        assert path.read_bytes()==content, 'Rebuild collector release: '+str(path)
    else:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(content)
print('Release verified: '+str(len(files))+' allowlisted files; SHA-256 '+checksum.split()[0])
