# Administration

Open https://xbtpulse.tech/admin. Applications submitted through `/contribute` are stored privately in the VPS SQLite data volume; they are not emailed.

For first access, run `docker exec xbtpulse-xbtpulse-1 node ops.mjs admin-bootstrap` over SSH. The single-use setup code expires after 30 minutes. Enter it on the admin page and choose a password of at least 14 characters. Store the password in your password manager. An expired code can be replaced by rerunning the command. If access is lost, `admin-reset` invalidates the password and all sessions and creates a new setup code. Never share setup codes publicly.

The review desk shows pending, approved and declined applications. Review the operator's identity and reporting scope before approving. Choose a unique public provider ID, confirm your review, and save the token shown once. Deliver it privately to the operator yourself. Approval does not send email, award a rating or map the provider to a pool automatically. Pool mappings still require review in `config/pools.json`.

Declined applications can be reopened. Revoke stops a database provider's new reports. Issue new token replaces the previous token and reactivates access. These controls manage database providers, not legacy `TELEMETRY_KEYS_JSON` entries. Tokens cannot be retrieved later. The activity list records actions without credentials.

Sessions expire after eight hours and use Secure, HttpOnly, SameSite cookies. Mutations require the configured request origin and a session CSRF token. Login attempts are globally limited to 20 per 15-minute window. Passwords use salted scrypt hashes; provider tokens and session tokens are stored as SHA-256 digests. Back up the data volume securely because it contains private applications and authentication data.

`ADMIN_ORIGIN` defaults to `https://xbtpulse.tech`; override it only for another deployment origin. HTTPS is required for the session cookie.
