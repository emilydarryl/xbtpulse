"""Deterministic adapter kit archive; only explicitly named public sources."""
import hashlib
import io
from pathlib import Path
import sys
import zipfile
root=Path(__file__).resolve().parent.parent
files={name:root/'collector'/'adapter-kit'/name for name in ['uploader.py','test_uploader.py','README.md','COMPATIBILITY.md','report.example.json']}
files['LICENSE']=root/'LICENSE'
buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_STORED) as z:
    for name,path in sorted(files.items()):
        info=zipfile.ZipInfo(name,date_time=(2026,9,13,0,0,0))
        info.create_system=3;info.external_attr=0o100644<<16
        z.writestr(info,path.read_text(encoding='utf-8-sig').replace('\r\n','\n'))
data=buffer.getvalue();name='xbtpulse-adapter-kit-0.1.0.zip'
artifacts={name:data,'ADAPTER-SHA256SUMS.txt':(hashlib.sha256(data).hexdigest()+'  '+name+'\n').encode()}
for name,content in artifacts.items():
    path=root/'public'/'downloads'/name
    if '--check' in sys.argv:
        assert path.read_bytes()==content, 'Rebuild adapter kit: '+name
    else:path.write_bytes(content)
print('Adapter kit verified: 6 allowlisted files; SHA-256 '+hashlib.sha256(data).hexdigest())
