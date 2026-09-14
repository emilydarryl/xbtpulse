import { randomBytes, createHash } from "node:crypto";
import { sumFound } from "./analytics.mjs";
const hash = (s) => createHash("sha256").update(s).digest("hex");
export function issueChallenge(store, provider, now = Date.now()) {
  const row = store.db
    .prepare("SELECT token_hash FROM providers WHERE id=? AND active=1")
    .get(provider);
  if (!row) throw Error("An active database provider is required.");
  const code = randomBytes(24).toString("hex");
  store.set("review-challenge:" + provider, {
    hash: hash(code),
    tokenHash: row.token_hash,
    expires: now + 1800000,
  });
  return { code, expires: now + 1800000 };
}
export function answerChallenge(store, provider, code, now = Date.now()) {
  const pending = store.get("review-challenge:" + provider);
  const row = store.db
    .prepare("SELECT token_hash FROM providers WHERE id=? AND active=1")
    .get(provider);
  if (
    !pending ||
    pending.expires <= now ||
    !row ||
    row.token_hash !== pending.tokenHash ||
    typeof code !== "string" ||
    code.length !== 48 ||
    hash(code) !== pending.hash
  )
    throw Error("Invalid, expired or already used challenge.");
  store.set("review-proof:" + provider, {
    tokenHash: row.token_hash,
    verifiedAt: now,
  });
  store.set("review-challenge:" + provider, null);
  return { verified: true };
}
export function reviewEvidence(store, application, now = Date.now()) {
  const providers = store.db
    .prepare("SELECT id,active,token_hash FROM providers WHERE application=?")
    .all(application.id);
  const reports = store.telemetry();
  const checks = [];
  const add = (label, passed, detail) =>
    checks.push({
      label,
      status: passed ? "Passed" : "Missing evidence",
      detail,
    });
  add(
    "Provider approval",
    providers.length > 0 && providers.every((p) => p.active === 1),
    "An administrator must approve a reporting provider before evidence collection.",
  );
  for (const p of providers) {
    const proof = store.get("review-proof:" + p.id);
    add(
      p.id + " · credential challenge",
      !!(
        p.active &&
        proof?.tokenHash === p.token_hash &&
        now - proof.verifiedAt <= 30 * 86400000 &&
        proof.verifiedAt <= now
      ),
      "A one-time response confirms access to this credential for 30 days; it does not prove identity, independence or report accuracy.",
    );
    const list = reports
      .filter(
        (r) => r.provider === p.id && r.start >= now - 86400000 && r.end <= now,
      )
      .sort((a, b) => a.start - b.start);
    const lastWork = Math.max(
      0,
      ...list.filter((r) => r.work > 0).map((r) => r.end),
    );
    add(
      p.id + " · recent work",
      !!p.active && lastWork > 0 && now - lastWork <= 1800000,
      "A report containing positive work must end within the last 30 minutes.",
    );
    let covered = 0,
      end = now - 86400000,
      overlap = false,
      inconsistent = false;
    for (const r of list) {
      if (r.start < end) overlap = true;
      covered += Math.max(0, r.end - Math.max(end, r.start));
      end = Math.max(end, r.end);
      if (
        (r.work === 0 && (r.found > 0 || r.expected > 0)) ||
        (r.work > 0 && r.expected <= 0)
      )
        inconsistent = true;
    }
    const coverage = covered / 86400000;
    add(
      p.id + " · 24-hour coverage",
      coverage >= 0.95,
      `${(coverage * 100).toFixed(1)}% of the last 24 hours covered by complete accepted intervals. Review readiness requires 95%; this is a workflow threshold, not a rating.`,
    );
    add(
      p.id + " · accepted report consistency",
      list.length > 0 && !overlap && !inconsistent,
      "Checks accepted intervals for overlap and contradictory work totals. Rejected submissions are not retained; ingestion rejects duplicates with changed content and overlapping intervals.",
    );
    const expected = list.reduce((n, r) => n + r.expected, 0),
      found = sumFound(list);
    checks.push({
      label: p.id + " · reported block outcomes",
      status: "Context only",
      detail: found === null
        ? `Block outcomes unavailable for all or part of this window; ${expected.toFixed(2)} expected from reported work. No found/expected comparison is available.`
        : `${found} reported found / ${expected.toFixed(2)} expected in complete intervals. Mining luck varies; this ratio is not a pass/fail test. Chain attribution and matching time windows require review.`,
    });
  }
  return {
    status: checks
      .filter((c) => c.status !== "Context only")
      .every((c) => c.status === "Passed")
      ? "Ready for review"
      : "Needs evidence",
    checkedAt: new Date(now).toISOString(),
    checks,
    manual: [
      "Verify operator identity and common ownership.",
      "Verify who constructs templates and any upstream dependencies.",
      "Review block attribution against report intervals; allow for luck and orphaned blocks.",
      "Recheck public fee/protocol sources where applicable; private pools need not publish fees.",
    ],
    providerIds: providers.filter((p) => p.active).map((p) => p.id),
  };
}

export function publicReview(store, profile, now = Date.now()) {
  if (!profile?.showReview || !profile.applicationId) return null;
  const review = reviewEvidence(store, { id: profile.applicationId }, now);
  return {
    status: review.status,
    checkedAt: review.checkedAt,
    checks: review.checks.map((c) => ({ label: c.label, status: c.status })),
  };
}
