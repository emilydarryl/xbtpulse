# Sign reviewed checksum files with the existing Windows-protected release key.
# Never generates or rotates a key. Run under the owning Windows account.
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$vault = Join-Path $env:LOCALAPPDATA 'XbtPulse\release-signing'
$encrypted = Join-Path $vault 'release-key.dpapi'
if (!(Test-Path -LiteralPath $encrypted)) { throw 'Existing signing key unavailable. Do not generate a replacement.' }
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls $vault /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot secure signing directory' }
Add-Type -AssemblyName System.Security
$temporaryKey = Join-Path $vault ('signing-'+[guid]::NewGuid().ToString())
$raw = $null
try {
    $raw = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encrypted),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($temporaryKey,$raw)
    $actual = ((& ssh-keygen -y -f $temporaryKey).Trim() -split ' ')[0..1] -join ' '
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read signing key' }
    $expected = ([IO.File]::ReadAllText((Join-Path $repo 'public/downloads/release-signing-key.pub')).Trim() -split ' ')[0..1] -join ' '
    if ($actual -ne $expected) { throw 'Signing key differs from published key' }
    foreach ($name in @('SHA256SUMS.txt','ADAPTER-SHA256SUMS.txt')) {
        $manifest = Join-Path $repo ('public/downloads/'+$name)
        $signature = $manifest+'.sig'
        if (Test-Path -LiteralPath $signature) { Remove-Item -LiteralPath $signature }
        & ssh-keygen -Y sign -f $temporaryKey -n releases@xbtpulse.tech $manifest
        if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
    }
} finally {
    if ($null -ne $raw) { [Array]::Clear($raw,0,$raw.Length) }
    if (Test-Path -LiteralPath $temporaryKey) { Remove-Item -LiteralPath $temporaryKey }
}
& python (Join-Path $repo 'scripts/verify-releases.py') (Join-Path $repo 'public/downloads')
if ($LASTEXITCODE -ne 0) { throw 'Signature verification failed' }
