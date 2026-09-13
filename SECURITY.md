# Security reporting

Please report suspected vulnerabilities privately using GitHub's **Security → Report a vulnerability** for this repository. Do not open a public issue containing an exploit, credential or private operator data.

Include the affected commit/version, a minimal reproduction, expected impact and sanitized logs. Do not access other operators' data or disrupt mining to demonstrate an issue. If private reporting is unavailable, ask the maintainer for a private channel without posting the vulnerability details.

The source repository must not contain production `.env` files, databases, collector configuration/state, wallet keys or provider tokens. Example configuration should use placeholders. The admin area, applications, conversations and unpublished evidence remain private even though source code is public.

Both checksum files have detached OpenSSH signatures. Verify the pinned key and signature before checking archive hashes; see [release verification](docs/release-signing.md). First-use key authenticity still requires an established trusted channel.
