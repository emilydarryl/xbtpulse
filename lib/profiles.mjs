export const profileFields = {
  fee: "Pool fee (%)",
  payout: "Payout method",
  minimum: "Minimum payout (XBT)",
  withdrawal: "Withdrawal fees",
  protocols: "Mining protocols",
  regions: "Server regions",
  setup: "Setup guide URL",
  template: "Template control",
};
export function validateProfile(body) {
  const result = {};
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
  return result;
}
export function publishProfile(store, body, knownIds) {
  if (body.reviewed !== true) throw Error("Confirm your review first.");
  if (!knownIds.has(body.poolId))
    throw Error("Use an observed pool ID from its profile page.");
  const app = store.applications().find((a) => a.id === body.application);
  if (!app?.body.profile || app.body.profileConsent !== true)
    throw Error("This application has no public profile consent.");
  const profile = {
    ...validateProfile(app.body.profile),
    website: app.body.website,
    reviewedAt: new Date().toISOString(),
  };
  store.set("pool-profile:" + body.poolId, profile);
  return profile;
}
