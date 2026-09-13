export const profileFields = {
  fee: "Pool fee (%)",
  payout: "Payout method",
  minimum: "Minimum payout (XBT)",
  withdrawal: "Withdrawal fees",
  protocols: "Mining protocols",
  regions: "Server regions",
  setup: "Setup guide URL",
  template: "Template control",
  ethos: "Operator statement",
};
export function validateProfile(body) {
  const result = {};
  const poolType = body.poolType || "unspecified";
  if (!["public", "private", "unspecified"].includes(poolType))
    throw Error("Choose public or private pool.");
  result.poolType = poolType;
  for (const key of Object.keys(profileFields)) {
    const value = body[key] ?? "";
    if (typeof value !== "string" || value.length > 500)
      throw Error("Please check pool " + key);
    result[key] = value.trim();
  }
  if (
    result.fee &&
    (!/^\d+(\.\d+)?$/.test(result.fee) || Number(result.fee) > 100)
  )
    throw Error("Pool fee must be between 0 and 100 percent.");
  if (result.minimum && !/^\d+(\.\d+)?$/.test(result.minimum))
    throw Error("Minimum payout must be a positive number or zero.");
  if (result.setup) {
    const url = new URL(result.setup);
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("Use an HTTPS setup guide without credentials.");
  }
  if (poolType === "private") {
    for (const key of ["fee", "payout", "minimum", "withdrawal", "setup"])
      result[key] = "";
  }
  return result;
}
export function publishProfile(store, body, knownIds) {
  if (body.reviewed !== true) throw Error("Confirm your review first.");
  const app = store.applications().find((a) => a.id === body.application);
  if (!app?.body.profile || app.body.profileConsent !== true)
    throw Error("This application has no public profile consent.");
  if (
    !knownIds.has(body.poolId) &&
    !(
      app.body.profile.poolType === "private" &&
      /^private:[a-z0-9_-]{1,80}$/.test(body.poolId)
    )
  )
    throw Error(
      "Use an observed pool ID, or private:your-pool-name for a private pool without attributed blocks.",
    );
  const existing = store.get("pool-profile:" + body.poolId);
  const profile = {
    applicationId: app.id,
    ...(existing?.showReview ? { showReview: true } : {}),
    ...validateProfile(app.body.profile),
    name: app.body.name,
    website: app.body.website,
    reviewedAt: new Date().toISOString(),
  };
  store.set("pool-profile:" + body.poolId, profile);
  return profile;
}
export function privateProfiles(store) {
  return store.db
    .prepare("SELECT key,value FROM meta WHERE key LIKE 'pool-profile:%'")
    .all()
    .map((r) => ({
      id: r.key.slice("pool-profile:".length),
      profile: JSON.parse(r.value),
    }))
    .filter((r) => r.profile?.poolType === "private")
    .map((r) => ({ id: r.id, name: r.profile.name || r.id }));
}
