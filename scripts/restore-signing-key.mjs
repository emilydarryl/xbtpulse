// Restore a portable encrypted XBT Pulse signing key. No network access.
// node scripts/restore-signing-key.mjs backup.json recovery-code.txt output.key
import { readFileSync, openSync, writeFileSync, closeSync, unlinkSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const [backupPath, recoveryPath, outputPath] = process.argv.slice(2);
let key, plain, created = false;
try {
  if (!backupPath || !recoveryPath || !outputPath) throw Error('Usage: node restore-signing-key.mjs backup.json recovery-code.txt output.key');
  const b = JSON.parse(readFileSync(backupPath, 'utf8').replace(/^\uFEFF/, ''));
  if (b.format !== 'xbtpulse-signing-backup-v1' || b.algorithm !== 'AES-256-GCM' || b.fingerprint !== 'SHA256:rn5J0wzL/7dY5OdKiSz+J2+nu0INP1ShjIb+cB7uZh0') throw Error('Unsupported backup or unexpected signing identity');
  const code = readFileSync(recoveryPath,'utf8').trim().replace(/^\uFEFF/,'');
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw Error('Invalid recovery-code format');
  key = Buffer.from(code,'base64url');
  const aad = Buffer.from(`${b.format}\n${b.algorithm}\n${b.fingerprint}\n${b.publicKey}`);
  const decipher = createDecipheriv('aes-256-gcm',key,Buffer.from(b.nonce,'base64'));
  decipher.setAAD(aad);decipher.setAuthTag(Buffer.from(b.tag,'base64'));
  plain = Buffer.concat([decipher.update(Buffer.from(b.ciphertext,'base64')),decipher.final()]);
  const fd = openSync(outputPath,'wx',0o600); created = true;
  try { writeFileSync(fd,plain); } finally { closeSync(fd); }
  const result = spawnSync('ssh-keygen',['-y','-f',outputPath],{encoding:'utf8'});
  if (result.status !== 0 || result.stdout.trim().split(/\s+/).slice(0,2).join(' ') !== b.publicKey.split(/\s+/).slice(0,2).join(' ')) throw Error('Restored key does not match the public identity');
  console.log('Restored signing key and verified public identity. Protect the output file; it is unencrypted.');
} catch (e) {
  if (created) unlinkSync(outputPath);
  console.error('Restore failed; no usable key retained. Check files, recovery code, permissions and OpenSSH availability.');
  process.exitCode = 1;
} finally { key?.fill(0);plain?.fill(0); }
