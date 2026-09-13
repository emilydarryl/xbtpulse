"""Verify the pinned release key, detached signatures and exact archive hashes."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
FINGERPRINT='SHA256:rn5J0wzL/7dY5OdKiSz+J2+nu0INP1ShjIb+cB7uZh0'
IDENTITY='releases@xbtpulse.tech'
PACKAGES={'SHA256SUMS.txt':'xbtpulse-datum-collector-1.0.0.zip',
          'ADAPTER-SHA256SUMS.txt':'xbtpulse-adapter-kit-0.1.0.zip'}

def verify(root):
    result=subprocess.run(['ssh-keygen','-lf',str(root/'release-signing-key.pub')],capture_output=True,text=True,check=True)
    if result.stdout.split()[1] != FINGERPRINT: raise ValueError('Release key fingerprint mismatch')
    key=' '.join((root/'release-signing-key.pub').read_text().split()[:2])
    expected=IDENTITY+' namespaces="'+IDENTITY+'" '+key
    if (root/'allowed_signers').read_text().strip() != expected:
        raise ValueError('Unexpected allowed-signers policy')
    for manifest,archive in PACKAGES.items():
        data=(root/manifest).read_bytes()
        result=subprocess.run(['ssh-keygen','-Y','verify','-f',str(root/'allowed_signers'),'-I',IDENTITY,'-n',IDENTITY,'-s',str(root/(manifest+'.sig'))],input=data,capture_output=True)
        if result.returncode: raise ValueError('Invalid signature: '+manifest)
        expected_line=hashlib.sha256((root/archive).read_bytes()).hexdigest()+'  '+archive+'\n'
        if data.decode() != expected_line: raise ValueError('Archive checksum mismatch: '+archive)

def self_test(root):
    verify(root)
    for name in ['SHA256SUMS.txt','xbtpulse-adapter-kit-0.1.0.zip','allowed_signers']:
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)
            for f in root.iterdir():
                if f.is_file(): shutil.copyfile(f,dest/f.name)
            with (dest/name).open('ab') as f:f.write(b'altered')
            try:verify(dest)
            except (ValueError,subprocess.CalledProcessError):pass
            else:raise ValueError('Tampering unexpectedly accepted: '+name)
    print('Tamper checks passed: checksum file, archive and signer policy')

if __name__=='__main__':
    root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent.parent/'public/downloads'
    try:
        verify(root)
        if '--self-test' in sys.argv:self_test(root)
        print('Both release signatures and archive hashes verified against '+FINGERPRINT)
    except (ValueError,OSError,subprocess.CalledProcessError) as e:
        print('Verification FAILED: '+str(e));raise SystemExit(1)
