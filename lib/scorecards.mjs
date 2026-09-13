export const criteria = [
  {
    id: "templates",
    axis: "decentralization",
    label: "Miner control of templates",
    weight: 40,
    rule: "Enter the independently verified percentage of assessed work whose transaction selection is controlled by miners. Document numerator, denominator, routing and unobserved work. DATUM use alone is insufficient.",
  },
  {
    id: "operators",
    axis: "decentralization",
    label: "Independent template operators",
    weight: 25,
    rule: "Enter 100 × (1 − sum of squared work fractions by independently verified controlling operator). Group common ownership. One controlling operator scores 0 for diversity, including a private single-operator pool; this does not negate its template autonomy. Unresolved ownership means not assessed.",
  },
  {
    id: "choice",
    axis: "decentralization",
    label: "Miner choice",
    weight: 20,
    rule: "Four tests worth 25% each: select transactions; change policy; verify intended template reaches mining hardware; verify no silent upstream substitution. Record each tested outcome. Untested outcomes mean not assessed; tested failures earn zero for that test.",
  },
  {
    id: "independence",
    axis: "decentralization",
    label: "Operational independence",
    weight: 15,
    rule: "Three tests worth one third each: change upstream; continue solo; retain node and template control through the transition. Document outcomes. Untested means not assessed.",
  },
  {
    id: "telemetry",
    axis: "transparency",
    label: "Consistent, complete telemetry",
    weight: 35,
    rule: "Enter the percentage of the entire assessed reporting scope and period covered by reconciled, non-overlapping work intervals. Verify counter units, resets and block outcomes; disclose gaps and overlapping gateways. If accounting or representativeness cannot be checked, leave not assessed.",
  },
  {
    id: "payout",
    axis: "transparency",
    label: "Payout rules and records",
    weight: 25,
    rule: "Four checks worth 25% each: applicable terms documented; allocation explained; conditions explained; records reconciled. All checks must be reviewed. Private pools need no public fees or addresses: document that public terms do not apply and review redacted reward-control and reconciliation evidence.",
  },
  {
    id: "ownership",
    axis: "transparency",
    label: "Ownership and routing disclosures",
    weight: 25,
    rule: "Four checks worth 25% each: operator identity reviewed; common-control groups documented; upstream routing disclosed; template responsibility mapped. Separate operator statements from independently corroborated facts. Unreviewed checks mean not assessed.",
  },
  {
    id: "incidents",
    axis: "transparency",
    label: "Incident transparency",
    weight: 15,
    rule: "Three checks worth one third each: reporting channel and policy published; dated incident or explicit no-known-incident log covers the period; discrepancies and remediation or the no-incident statement reconciled against available reports. No incidents alone does not earn full credit.",
  },
];
export const rubric = "pilot-v0.2";
const bounded = (v, max, label) => {
  if (typeof v !== "string" || v.length > max) throw Error("Invalid " + label);
  return v.trim();
};
export function validateScorecard(input, now = Date.now()) {
  const result = {
    rubric,
    reviewer: bounded(input.reviewer, 120, "reviewer"),
    scope: bounded(input.scope, 2000, "scope"),
    reason: bounded(input.reason, 1500, "change reason"),
    start: input.start,
    end: input.end,
    rows: [],
  };
  for (const field of ["start", "end"])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(result[field] || "") ||
      !Number.isFinite(Date.parse(result[field])) ||
      new Date(result[field]).toISOString().slice(0, 10) !== result[field]
    )
      throw Error("Use valid observation dates");
  if (result.start > result.end || Date.parse(result.end) > now)
    throw Error("Invalid observation period");
  if (!Array.isArray(input.rows) || input.rows.length !== criteria.length)
    throw Error("All criteria are required");
  for (const c of criteria) {
    const matches = input.rows.filter((r) => r.id === c.id);
    if (matches.length !== 1) throw Error("Duplicate or missing criterion");
    const r = matches[0];
    if (
      r.percent !== null &&
      (typeof r.percent !== "number" ||
        !Number.isFinite(r.percent) ||
        r.percent < 0 ||
        r.percent > 100)
    )
      throw Error("Criterion percentage must be blank or 0–100");
    if (
      r.percent !== null &&
      ["choice", "payout", "ownership"].includes(c.id) &&
      ![0, 25, 50, 75, 100].includes(r.percent)
    )
      throw Error("Four-check criteria use 0, 25, 50, 75 or 100 percent");
    if (
      r.percent !== null &&
      ["independence", "incidents"].includes(c.id) &&
      ![0, 33.33, 66.67, 100].includes(r.percent)
    )
      throw Error("Three-check criteria use 0, 33.33, 66.67 or 100 percent");
    const row = {
      id: c.id,
      percent: r.percent,
      evidence: bounded(r.evidence, 2500, "public evidence"),
      checked: r.checked || "",
    };
    if (
      row.checked &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(row.checked) ||
        !Number.isFinite(Date.parse(row.checked)) ||
        new Date(row.checked).toISOString().slice(0, 10) !== row.checked ||
        Date.parse(row.checked) > now)
    )
      throw Error("Invalid evidence date");
    if (row.percent !== null && (row.evidence.length < 30 || !row.checked))
      throw Error("Every scored criterion needs evidence and a review date");
    result.rows.push(row);
  }
  return result;
}
export function scoreTotals(card) {
  return Object.fromEntries(
    ["decentralization", "transparency"].map((axis) => {
      const list = criteria.filter((c) => c.axis === axis);
      return [
        axis,
        list.every((c) => card.rows.find((r) => r.id === c.id)?.percent != null)
          ? Math.round(
              list.reduce(
                (n, c) =>
                  n +
                  (c.weight * card.rows.find((r) => r.id === c.id).percent) /
                    100,
                0,
              ) * 10,
            ) / 10
          : null,
      ];
    }),
  );
}
export function applicationProfiles(store, id) {
  return store.db
    .prepare("SELECT key,value FROM meta WHERE key LIKE 'pool-profile:%'")
    .all()
    .filter((r) => JSON.parse(r.value)?.applicationId === id)
    .map((r) => ({
      id: r.key.slice(13),
      name: JSON.parse(r.value).name || r.key.slice(13),
    }));
}
export function getScorecard(store, id) {
  const application = store.applications().find((a) => a.id === id);
  if (!application) throw Error("Application not found");
  return {
    name: application.body.name,
    criteria,
    rubric,
    profiles: applicationProfiles(store, id),
    draft: store.get("score-draft:" + id),
    history: store.get("score-history:" + id) || [],
  };
}
export function saveScorecard(store, id, input, version, now = Date.now()) {
  getScorecard(store, id);
  const old = store.get("score-draft:" + id);
  if ((old?.version || 0) !== version)
    throw Error("This draft changed. Reload before saving.");
  const card = {
    ...validateScorecard(input, now),
    version: version + 1,
    savedAt: now,
  };
  store.set("score-draft:" + id, card);
  return card;
}
export function publishScorecard(store, body, now = Date.now()) {
  const a = store.applications().find((a) => a.id === body.application);
  if (!a || a.status !== "approved" || a.body.profileConsent !== true)
    throw Error("Approved operator and public profile consent required");
  if (!applicationProfiles(store, a.id).some((p) => p.id === body.poolId))
    throw Error("Choose this operator’s published profile");
  const card = store.get("score-draft:" + a.id);
  if (!card || card.version !== body.version || body.reviewed !== true)
    throw Error("Preview the current saved draft and confirm review");
  validateScorecard(card, now);
  const totals = scoreTotals(card);
  if (Object.values(totals).some((v) => v === null))
    throw Error("All criteria must be assessed before publishing totals");
  if (!card.reviewer || card.scope.length < 30 || card.reason.length < 10)
    throw Error("Reviewer, scope and change reason required");
  if (Date.parse(card.end) - Date.parse(card.start) < 29 * 86400000)
    throw Error("At least 30 calendar days of observation required");
  if (
    now - Date.parse(card.end) > 30 * 86400000 ||
    card.rows.some((r) => now - Date.parse(r.checked) > 30 * 86400000)
  )
    throw Error(
      "Observation period and evidence reviews must be within 30 days",
    );
  const existing = store.get("score-published:" + body.poolId);
  if (existing?.version === card.version && existing?.savedAt === card.savedAt)
    return existing;
  const published = { ...card, totals, publishedAt: now, poolId: body.poolId };
  store.db.exec("BEGIN IMMEDIATE");
  try {
    store.set("score-published:" + body.poolId, published);
    store.set(
      "score-history:" + a.id,
      [published, ...(store.get("score-history:" + a.id) || [])].slice(0, 50),
    );
    store.db.exec("COMMIT");
  } catch (e) {
    store.db.exec("ROLLBACK");
    throw e;
  }
  return published;
}
export function publicScorecard(store, poolId) {
  const p = store.get("pool-profile:" + poolId);
  if (!p?.applicationId) return null;
  const a = store.applications().find((a) => a.id === p.applicationId);
  if (a?.status !== "approved" || a?.body.profileConsent !== true) return null;
  return store.get("score-published:" + poolId);
}
