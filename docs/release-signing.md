# Verify XBT Pulse downloads

Both release checksum files now have detached OpenSSH Ed25519 signatures. The existing DATUM v1.0.0 and adapter-kit v0.1.0 ZIP bytes have not changed. Older README text inside the adapter ZIP describes the pre-signature release; use this current verification guide.

## Pin the release key

First published 2026-09-13. Identity and signature namespace: `releases@xbtpulse.tech`.

**Fingerprint:**

```text
SHA256:rn5J0wzL/7dY5OdKiSz+J2+nu0INP1ShjIb+cB7uZh0
```

Compare this fingerprint through a channel you already trust, then keep your own copy. A key downloaded beside a package establishes no independent trust on its first use. A signature proves possession of the pinned key, not that the software or measurements are correct. Do not automatically accept a changed key.

Public files at https://xbtpulse.tech/downloads/:

- `release-signing-key.pub`: public key, never an SSH login credential.
- `allowed_signers`: signer identity and namespace policy.
- `SHA256SUMS.txt` and `SHA256SUMS.txt.sig`: DATUM collector checksum and signature.
- `ADAPTER-SHA256SUMS.txt` and `ADAPTER-SHA256SUMS.txt.sig`: adapter-kit checksum and signature.

## Verify on Linux / OpenSSH

Download the package, its checksum and detached signature, and the public key. For the DATUM package:

```sh
curl -fSLO https://xbtpulse.tech/downloads/release-signing-key.pub
curl -fSLO https://xbtpulse.tech/downloads/SHA256SUMS.txt
curl -fSLO https://xbtpulse.tech/downloads/SHA256SUMS.txt.sig
curl -fSLO https://xbtpulse.tech/downloads/xbtpulse-datum-collector-1.0.0.zip
ssh-keygen -lf release-signing-key.pub
# Compare the fingerprint above BEFORE trusting this key.
# Build your signer policy from the key you verified:
printf 'releases@xbtpulse.tech namespaces="releases@xbtpulse.tech" %s\n' "$(cat release-signing-key.pub)" > allowed_signers
ssh-keygen -Y verify -f allowed_signers -I releases@xbtpulse.tech \
  -n releases@xbtpulse.tech -s SHA256SUMS.txt.sig < SHA256SUMS.txt
# Run this only if the signature verification succeeded:
sha256sum -c SHA256SUMS.txt
```

For the adapter kit, use `ADAPTER-SHA256SUMS.txt`, `ADAPTER-SHA256SUMS.txt.sig` and `xbtpulse-adapter-kit-0.1.0.zip`. Verify the signature before using its checksum. Stop on any failure; do not bypass it or regenerate checksums locally as a substitute.

The repository's `python scripts/verify-releases.py public/downloads --self-test` verifies both packages against the pinned fingerprint and tests altered manifests, archives and signer policies. Python 3 plus OpenSSH are required. It also works with a local directory containing all eight public verification/download files (two ZIPs, two checksum files, two signatures, public key and signer policy: eight files total).

OpenSSH command reference: https://man.openbsd.org/ssh-keygen. This uses `-Y verify`, not a GPG `.asc` signature.

## Maintainer release procedure

1. Review source changes and run tests. Use a new archive version for changed distributed files.
2. Build and check packages with `collector/package.py` and `collector/package-adapter.py`.
3. On the authorized Windows signing workstation, run `scripts/sign-releases.ps1`. It uses the existing key; it never silently creates or rotates one. It decrypts into an access-restricted temporary file, signs, removes that file in cleanup and verifies the result.
4. Run `scripts/verify-releases.py public/downloads --self-test`, commit the public artifacts, and deploy. CI verifies signatures and archive hashes, but has no private signing key.
5. Re-download deployed files and verify again. Publish the fingerprint through an established operator communication channel for initial pinning.

The private key is Windows-user-protected encrypted data in `%LOCALAPPDATA%/XbtPulse/release-signing`, restricted to that account and SYSTEM. A second encrypted recovery copy was verified locally. It is tied to the same Windows account/machine protection; **it is not a portable offline backup and does not protect against losing that machine/account**. A separate portable AES-256-GCM export is now available to the maintainer, protected by a randomly generated 256-bit recovery code. It was independently restored and its public identity verified. Store that export on disconnected media and its recovery code separately; a local copy alone is not an offline backup. The code and encrypted export together grant signing authority. Never commit encrypted or plaintext private-key material to this repository, upload it to the VPS, or put it in CI secrets.

If the key is lost or suspected compromised, stop signing. Announce revocation and replacement through established channels; cross-sign a replacement only while the old key is still trusted. Reviewers must explicitly approve a new fingerprint. The verifier and documentation must be updated intentionally for a key rotation.

## Portable recovery

The portable export uses authenticated AES-256-GCM with a random nonce and 256-bit recovery key. Its format, algorithm, fingerprint and public key are authenticated metadata. The export is independent of Windows DPAPI. Never commit the export or recovery code. Keep the code in a password manager separately from backup media.

In a private directory on a recovery machine with Node.js and OpenSSH, save the recovery code temporarily in a user-only text file, then run:

```sh
node scripts/restore-signing-key.mjs xbtpulse-signing-backup-v1.json recovery-code.txt restored-signing.key
ssh-keygen -lf restored-signing.key
```

The tool refuses to overwrite an existing file, authenticates before writing, and checks the recovered public key. It removes its output on verification failure. The recovered key is **unencrypted**: protect its directory/permissions, re-encrypt or import it into protected signing storage promptly, and remove the temporary recovery-code file when finished. On Windows, restrict the output directory to your account and SYSTEM before restoring; POSIX output files are created mode 0600. Loss of the recovery code makes this export unusable.
